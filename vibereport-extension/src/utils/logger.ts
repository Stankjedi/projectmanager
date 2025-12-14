/**
 * Centralized Logger for Vibe Report Extension
 */

import * as vscode from 'vscode';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private static instance: Logger;
  private outputChannel: vscode.OutputChannel | null = null;
  private level: LogLevel = LogLevel.INFO;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  initialize(outputChannel: vscode.OutputChannel): void {
    this.outputChannel = outputChannel;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private formatMessage(level: string, context: string, message: string): string {
    const timestamp = new Date().toISOString().substring(11, 23);
    return `[${timestamp}] [${level}] [${context}] ${message}`;
  }

  private write(message: string): void {
    if (this.outputChannel) {
      this.outputChannel.appendLine(message);
    }
  }

  debug(context: string, message: string): void {
    if (this.level <= LogLevel.DEBUG) {
      this.write(this.formatMessage('DEBUG', context, message));
    }
  }

  info(context: string, message: string): void {
    if (this.level <= LogLevel.INFO) {
      this.write(this.formatMessage('INFO', context, message));
    }
  }

  warn(context: string, message: string): void {
    if (this.level <= LogLevel.WARN) {
      this.write(this.formatMessage('WARN', context, message));
    }
  }

  error(context: string, message: string, error?: Error): void {
    if (this.level <= LogLevel.ERROR) {
      let fullMessage = this.formatMessage('ERROR', context, message);
      if (error?.stack) {
        fullMessage += `\n  Stack: ${error.stack}`;
      }
      this.write(fullMessage);
    }
  }

  show(): void {
    this.outputChannel?.show();
  }
}

export const logger = Logger.getInstance();
