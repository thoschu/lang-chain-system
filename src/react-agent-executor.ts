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
import { toUpper, append } from 'ramda';
import { z } from 'zod';

import { runAgentReasoning, toolNode } from './nodes.ts';
import { stateAnnotation, State, StateUpdate, Node } from './types.ts';

import { logHeader, logInfo, logSuccess, logError, log, Icons, Colors } from './logger.js';

const { env } = process;
const { PROD } = env;

logHeader(`React Agent Executor with LangGraph is running in ${PROD === 'true' ? 'production' : 'development'} mode with function calling...`);

const DOUBLE: string = 'double' as const;

const init: Node = (state: State): State => {
    const messages = state.messages;
    const systemMsg: SystemMessage = new SystemMessage('You are a helpful math agent.');

    console.dir(state);

    //const m = messages.pop(systemMsg)

    return {
        messages: [],
        value: 0
    };
};

const shouldContinue: (state: State) => 'double' | typeof END = (state: State): 'double' | typeof END => {
    logInfo(state.value.toString());
    logInfo( shouldContinue.name);


    if (state.value <= 100) {
        return 'double';
    }

    return END;
}

const increment: GraphNode<typeof stateAnnotation> = (state: State): State => {
    logSuccess(state.value.toString());

    logSuccess(state.messages.toString());

    return {
        messages: state.messages,
        value: state.value + 1,
    };
};

const double: Node = (state: State): State => {
    logSuccess(state.value.toString());

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

    .addEdge(START, 'init')
    .addEdge('init', 'reasoning')
    .addEdge('reasoning', 'increment')
    .addEdge('increment', 'double')
    //.addEdge('double', END)
    .addConditionalEdges('double', shouldContinue, [ 'double', END ])
    .compile();

const result = await graph.invoke({
    messages: [
        new HumanMessage('What is the temperature in Tokyo right now? List it and then uppercase it.')
    ],
    value: 1,
}).then(async (res) => {
    //console.log(res);

    const drawableGraph = await graph.getGraphAsync();
    const image: Blob = await drawableGraph.drawMermaidPng();
    const imageBuffer: Uint8Array<ArrayBuffer> = new Uint8Array(await image.arrayBuffer());

    await fs.writeFile('./graph.png', imageBuffer);

    return res;
});

console.log(result);



//console.log(result.messages.at(-1)?.content);

// stateGraphFlow.addNode(AGENT_REASON, runAgentReasoning);
// stateGraphFlow.setEntryPoint(AGENT_REASON);
// stateGraphFlow.addNode(ACT, runAgentAct);
//
// stateGraphFlow.addEdge(START, AGENT_REASON);



// const systemMessage: SystemMessage = new SystemMessage(
//     "You are a helpful shopping assistant. " +
//     "Response always in uppercase and use to_upper_case_tool. " +
//     "You have access to two tools: [to_upper_case_tool, firecrawl_search_tool]\n\n"
// );
// const humanMessage: HumanMessage = new HumanMessage('Wo liegt Zürich?');
//
// const messages: Array<BaseMessage> = [systemMessage, humanMessage];
//
// const res = llmWithTools.invoke(messages);
//
// res.then((result: AIMessage) => {
//     console.log(result);
// });
