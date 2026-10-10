import 'dotenv/config';

import { SystemMessage, AIMessageChunk, MessageStructure, MessageToolSet, BaseMessage, MessageType } from '@langchain/core/messages';
import { MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';

import { llm, tools } from './react.ts';
import { stateAnnotation, State, StateUpdate, Node, ToolCallingLlm } from './types.ts';

export const runAgentReasoning: Node = async (state: State) => {
    const SYSTEM_MESSAGE: string = `You are a helpful agent that can use tools to answer questions.`;
    const systemMessage: SystemMessage = new SystemMessage(SYSTEM_MESSAGE);
    const { ollama }: Record<'ollama', ToolCallingLlm> = llm;
    const { messages: stateMessages, value }: State = state;
    const promptMessages: Array<BaseMessage<MessageStructure<MessageToolSet>, MessageType>> = [systemMessage, ...stateMessages];
    const response: AIMessageChunk<MessageStructure<MessageToolSet>> = await ollama.invoke(promptMessages);
    const messages: Array<AIMessageChunk<MessageStructure<MessageToolSet>>> = [response];

    return {
        messages,
        value
    };
};

export const toolNode: ToolNode = new ToolNode(tools);
