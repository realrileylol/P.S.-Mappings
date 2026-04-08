type ToastType = 'success' | 'info' | 'warning';
type Listener = (msg: string, type: ToastType) => void;

let _listener: Listener | null = null;

export function _registerToastListener(fn: Listener) {
  _listener = fn;
}

export function toast(msg: string, type: ToastType = 'success') {
  _listener?.(msg, type);
}
