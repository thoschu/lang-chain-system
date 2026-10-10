import { ChatMessage } from '@langchain/core/messages';

export class ErrorMessage extends ChatMessage {
    static readonly ROLE: string = 'error';

    constructor(content: string) {
        super(content, ErrorMessage.ROLE);
    }

    static isErrorMessage(message: unknown): message is ErrorMessage {
        return ChatMessage.isInstance(message) && message.role === ErrorMessage.ROLE;
    }
}
