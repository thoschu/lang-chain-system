import 'dotenv/config';

import { SystemMessage, AIMessageChunk, MessageStructure, MessageToolSet, BaseMessage, MessageType } from '@langchain/core/messages';
import { MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';

import { llm, tools } from './react.ts';
import { stateAnnotation, State, StateUpdate, Node } from './types.ts';

const SYSTEM_MESSAGE: string = `You are a helpful math agent that can use tools to answer questions.`;
const systemMessage: SystemMessage = new SystemMessage(SYSTEM_MESSAGE);

export const runAgentReasoning = async (state: State) => {
    const messages: Array<BaseMessage<MessageStructure<MessageToolSet>, MessageType>> = state.messages;
    const response: AIMessageChunk<MessageStructure<MessageToolSet>> = await llm.invoke([
        systemMessage,
        ...messages,
    ]);

    return {
        messages: [response],
        index: state.index
    };
};

//export const toolNode: ToolNode<typeof MessagesAnnotation.State, typeof MessagesAnnotation.State> = new ToolNode(tools);
export const toolNode = new ToolNode(tools);
