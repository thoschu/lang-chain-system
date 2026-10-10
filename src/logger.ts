import { add } from 'ramda';

export enum Icons {
    GREEN_CHECK = '✅',
    RED_CROSS = '❌',
    WARNING = '⚠️',
    INFO = 'ℹ️',
    ROCKET = '🚀',
    DONE = '💡'
}

export type ConsoleMethod = 'dir' | 'log' | 'info' | 'warn' | 'error' | 'debug';

export type LogInfo =
    Partial<
        Record<'message', string> |
        Record<'colors', Colors | Array<Colors>> |
        Record<'method', ConsoleMethod> |
        Record<'icon', Icons>
    >;

export class Colors {
    static readonly BLACK: "[30m" = '\x1b[30m';
    static readonly PURPLE: "[95m" = '\x1b[95m';
    static readonly CYAN: "[96m" = '\x1b[96m';
    static readonly DARKCYAN: "[36m" = '\x1b[36m';
    static readonly BLUE: "[94m" = '\x1b[94m';
    static readonly GREEN: "[92m" = '\x1b[92m';
    static readonly YELLOW: "[93m" = '\x1b[93m';
    static readonly RED: "[91m" = '\x1b[91m';
    static readonly BOLD: "[1m" = '\x1b[1m';
    static readonly UNDERLINE: "[4m" = '\x1b[4m';
    static readonly END: "[0m" = '\x1b[0m';
}

function log(message: unknown, method: ConsoleMethod = 'log'): void {
    console[method](`${message}${Colors.END}`);
}

function logInfo(message: string, color: string = Colors.CYAN): void {
    log(`${color}${Icons.INFO} ${message}`);
}

function logSuccess(message: string): void {
    log(`${Colors.GREEN}${Icons.GREEN_CHECK}  ${message}`);
}

function logError(message: unknown): void {
    log(`${Colors.RED}${Icons.RED_CROSS}  ${message}`);
}

function logWarning(message: string): void {
    log(`${Colors.YELLOW}${Icons.WARNING}  ${message}`);
}

function logHeader(message: string): void {
    const headerLength: number = add(message.length, 4);
    const headerLine: string = `${Colors.BOLD}${Colors.PURPLE}${'='.repeat(headerLength)}${Colors.END}`;

    log(
        `\n${headerLine}`
    );

    log(
        `${Colors.BOLD}${Colors.PURPLE}${Icons.ROCKET}  ${message}${Colors.END}`
    );

    log(
        `${headerLine}\n`
    );
}

export { log, logInfo, logSuccess, logError, logWarning, logHeader };
