export interface LogEntry {
	id: number;
	timestamp: number;
	level: 'info' | 'warn' | 'error' | 'debug';
	source: string;
	message: string;
}

const MAX_LOGS = 1000;
let nextId = 0;
let logs = $state<LogEntry[]>([]);

export function getLogs() {
	return logs;
}

export function addLog(level: LogEntry['level'], source: string, message: string) {
	const entry: LogEntry = { id: nextId++, timestamp: Date.now(), level, source, message };
	logs.push(entry);
	if (logs.length > MAX_LOGS) {
		logs = logs.slice(logs.length - MAX_LOGS);
	}
}

export function clearLogs() {
	logs.length = 0;
}
