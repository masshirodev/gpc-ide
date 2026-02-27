export interface Toast {
    id: number;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
    duration: number;
}

export interface Notification {
    id: number;
    message: string;
    type: Toast['type'];
    timestamp: number;
    read: boolean;
}

const MAX_NOTIFICATIONS = 100;

let nextId = 0;
let toasts = $state<Toast[]>([]);
let notifications = $state<Notification[]>([]);

export function getToasts() {
    return toasts;
}

export function getNotifications() {
    return notifications;
}

export function getUnreadCount(): number {
    return notifications.filter(n => !n.read).length;
}

export function addToast(
    message: string,
    type: Toast['type'] = 'info',
    duration = 4000
) {
    const id = nextId++;
    toasts = [...toasts, { id, message, type, duration }];

    // Also record in notification history
    notifications = [
        { id, message, type, timestamp: Date.now(), read: false },
        ...notifications
    ].slice(0, MAX_NOTIFICATIONS);

    if (duration > 0) {
        setTimeout(() => {
            dismissToast(id);
        }, duration);
    }
}

export function dismissToast(id: number) {
    toasts = toasts.filter((t) => t.id !== id);
}

export function markAllRead() {
    notifications = notifications.map(n => ({ ...n, read: true }));
}

export function clearNotifications() {
    notifications = [];
}
