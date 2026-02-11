export interface Toast {
    id: number;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
    duration: number;
}

let nextId = 0;
let toasts = $state<Toast[]>([]);

export function getToasts() {
    return toasts;
}

export function addToast(
    message: string,
    type: Toast['type'] = 'info',
    duration = 4000
) {
    const id = nextId++;
    toasts = [...toasts, { id, message, type, duration }];

    if (duration > 0) {
        setTimeout(() => {
            dismissToast(id);
        }, duration);
    }
}

export function dismissToast(id: number) {
    toasts = toasts.filter((t) => t.id !== id);
}
