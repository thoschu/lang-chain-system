import 'dotenv/config';

import * as fs from 'node:fs/promises';

import { DynamicStructuredTool } from 'langchain';
import { START, END, StateGraph, Graph, StateSchema, MessagesAnnotation, MessagesValue, GraphNode } from '@langchain/langgraph';
import type { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import type { AIMessageChunk, MessageStructure, MessageToolSet, BaseMessage, MessageType } from '@langchain/core/messages';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { Runnable }  from '@langchain/core/runnables';
import { ChatOllama, type ChatOllamaCallOptions } from '@langchain/ollama';
import { tool } from 'langchain/tools';
import { Firecrawl, type SearchData } from 'firecrawl';
import { toUpper, append, prop, last, length, and } from 'ramda';
import { z } from 'zod';

import { runAgentReasoning, toolNode } from './nodes.ts';
import { stateAnnotation, State, StateUpdate, Node } from './types.ts';

import { logHeader, logInfo, logSuccess, logError, log, Icons, Colors } from './logger.js';

const { env } = process;
const { PROD } = env;

logHeader(`React Agent Executor with LangGraph is running in ${PROD === 'true' ? 'production' : 'development'} mode with function calling...`);

const DOUBLE: string = 'double' as const;

const init: Node = (state: State): State => {
    const { messages, value }: State = state;

    logInfo('init');

    return {
        messages, value: value + 10
    };
};

const shouldContinue: (state: State) => 'double' | typeof END = (state: State): 'double' | typeof END => {
    logInfo('shouldContinue');

    if (state.value <= 100) {
        return 'double';
    }

    return END;
}

const shouldContinueAfterReasoning = (state: State) => {
    const { messages }: State = state;
    const lastMessage: BaseMessage<MessageStructure<MessageToolSet>, MessageType> | undefined = last(messages);

    logInfo('shouldContinueAfterReasoning');

    if (lastMessage instanceof AIMessage && prop('tool_calls', lastMessage)?.length !== 0) {
        const message: AIMessage = lastMessage;

        return 'tool';
    }

    return 'increment';
}

const increment: GraphNode<typeof stateAnnotation> = (state: State): State => {
    logInfo('increment');

    return {
        messages: state.messages,
        value: state.value + 1,
    };
};

const double: Node = (state: State): State => {
    logInfo('double');

    return {
        messages: state.messages,
        value: state.value * 2,
    };
};

const graph = new StateGraph(stateAnnotation)
    .addNode('init', init)
    .addNode('reasoning', runAgentReasoning)
    .addNode('increment', increment)
    .addNode('double', double)
    .addNode('tool', toolNode)

    .addEdge(START, 'init')
    .addEdge('init', 'reasoning')
    .addEdge('tool', 'reasoning')
    .addEdge('increment', 'double')

    .addConditionalEdges('reasoning', shouldContinueAfterReasoning, [ 'tool', 'increment' ])
    .addConditionalEdges('double', shouldContinue, [ 'double', END ])

    .compile();

const result: State = await graph.invoke({
    messages: [
        new HumanMessage('What is the current weather in Tokyo right now? List it and then triple it.')
    ],
    value: 1,
}).then(async (state: State) => {
    const drawableGraph = await graph.getGraphAsync();
    const image: Blob = await drawableGraph.drawMermaidPng();
    const imageBuffer: Uint8Array<ArrayBuffer> = new Uint8Array(await image.arrayBuffer());

    await fs.writeFile('./graph.png', imageBuffer);

    console.dir(state);

    return state;
});

console.log('#####################');
const { messages, value }: State = result;
const lastMessage: BaseMessage<MessageStructure<MessageToolSet>, MessageType> = last(messages)!;
const content = lastMessage?.content ?? 'No content found in the last message.';
console.log(content);
