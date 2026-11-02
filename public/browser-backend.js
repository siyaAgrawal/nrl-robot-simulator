// Runs server.py inside the visitor's browser with Pyodide, so the hosted
// dashboard works with no Python server. Replaces socket.io's io() and routes
// fetch('/api/...') to the Flask view functions in server.py.
(function () {
  const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  const listeners = {};
  const fire = (ev, data) => (listeners[ev] || []).forEach((fn) => {
    try { fn(data); } catch (e) { console.error(e); }
  });

  const socket = {
    connected: false,
    on(ev, fn) {
      (listeners[ev] = listeners[ev] || []).push(fn);
      if (ev === 'connect' && this.connected) fn();
      return this;
    },
    off(ev, fn) {
      listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn);
      return this;
    },
    emit() { return this; },
    connect() { return this; },
    disconnect() { return this; },
    io: { on() {} },
  };
  window.io = () => socket;
  window.__robotEmit = (ev, json) => fire(ev, JSON.parse(json));

  function setStatus(text, color) {
    const el = document.getElementById('statusText');
    if (el) { el.textContent = text; el.style.color = color; }
  }

  let resolveReady, rejectReady;
  const ready = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });
  let handle;

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) {
      return realFetch(input, init);
    }
    await ready;
    const method = (init.method || 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? init.body : '';
    const [status, data] = JSON.parse(handle(url.pathname, method, url.search.slice(1), body));
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };

  const STUBS = {
    'flask.py': `
class _Req:
    def __init__(self):
        self.method = 'GET'; self.json = None; self.args = {}
request = _Req()
class _Resp:
    def __init__(self, data, status=200):
        self.data = data; self.status = status
def jsonify(*a, **k):
    return _Resp(a[0] if a else k)
def render_template(*a, **k):
    return ''
def send_from_directory(*a, **k):
    return ''
class Flask:
    def __init__(self, *a, **k):
        self.config = {}; self.routes = {}
    def route(self, path, methods=None):
        def deco(fn):
            self.routes[path] = fn
            return fn
        return deco
`,
    'flask_socketio.py': `
import json, js
def _conv(o):
    if hasattr(o, 'item'): return o.item()
    if hasattr(o, 'tolist'): return o.tolist()
    if isinstance(o, (set, tuple)): return list(o)
    return str(o)
def _send(ev, data):
    js.__robotEmit(ev, json.dumps(data, default=_conv))
class SocketIO:
    def __init__(self, *a, **k):
        self.handlers = {}
    def on(self, ev):
        def deco(fn):
            self.handlers[ev] = fn
            return fn
        return deco
    def emit(self, ev, data=None, **k):
        _send(ev, data)
    def run(self, *a, **k):
        pass
def emit(ev, data=None, **k):
    _send(ev, data)
`,
    'serial.py': `
class Serial:
    def __init__(self, *a, **k):
        raise OSError('No serial port in the browser')
`,
  };

  const BRIDGE = `
import json, time, traceback, flask, robot_server as s
from urllib.parse import parse_qsl
from flask_socketio import _send, _conv

def _connect_serial():
    if not s.mock_simulator:
        s.mock_simulator = s.MockRobotSimulator()
    s.serial_running = True
    return True
s.connect_serial = _connect_serial
s.mock_simulator = s.MockRobotSimulator()

def tick():
    if not s.serial_running or not s.mock_simulator or not s.mock_simulator.current_sim:
        return
    data = s.mock_simulator.current_sim.generate_telemetry()
    if data:
        data['pc_timestamp'] = time.time()
        s.telemetry_buffer.append(data)
        s.update_hardware_health(list(s.telemetry_buffer)[-10:])
        _send('telemetry', data)

def handle(path, method, query, body):
    fn = s.app.routes.get(path)
    if fn is None:
        return json.dumps([404, {'error': 'Unknown endpoint ' + path}])
    flask.request.method = method
    flask.request.args = dict(parse_qsl(query))
    flask.request.json = json.loads(body) if body else ({} if method == 'POST' else None)
    try:
        r = fn()
    except Exception as e:
        traceback.print_exc()
        return json.dumps([500, {'success': False, 'error': str(e)}])
    status = 200
    if isinstance(r, tuple):
        r, status = r[0], r[1]
    data = r.data if isinstance(r, flask._Resp) else r
    return json.dumps([status, data], default=_conv)
`;

  async function boot() {
    setStatus('🟡 Loading simulator…', '#ffb300');
    await new Promise((res, rej) => {
      const tag = document.createElement('script');
      tag.src = PYODIDE + 'pyodide.js';
      tag.onload = res;
      tag.onerror = () => rej(new Error('Could not load Pyodide'));
      document.head.appendChild(tag);
    });
    const py = await window.loadPyodide({ indexURL: PYODIDE });
    await py.loadPackage(['numpy', 'scikit-learn']);
    py.FS.mkdirTree('/robot');
    for (const [name, src] of Object.entries(STUBS)) py.FS.writeFile('/robot/' + name, src);
    const server = await (await realFetch('/server.py')).text();
    py.FS.writeFile('/robot/robot_server.py', server);
    py.runPython("import sys; sys.path.insert(0, '/robot')");
    py.runPython(BRIDGE);
    handle = py.globals.get('handle');
    const tick = py.globals.get('tick');
    setInterval(() => { try { tick(); } catch (e) { console.error(e); } }, 50);
    resolveReady();
    socket.connected = true;
    fire('connect');
    fire('status', { connected: true, challenge: null });
    setStatus('🟢 Simulator running in your browser', '#4caf50');
  }

  boot().catch((e) => {
    console.error(e);
    rejectReady(e);
    setStatus('🔴 Simulator failed to load: ' + e.message, '#f44336');
  });
})();
