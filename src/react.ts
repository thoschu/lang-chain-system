import 'dotenv/config';

import { DynamicStructuredTool } from 'langchain';
import type { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import { AIMessageChunk, type MessageStructure, MessageToolSet } from '@langchain/core/messages';
import { AIMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';
import { ChatOllama, type ChatOllamaCallOptions } from '@langchain/ollama';
import { tool } from 'langchain/tools';
import { Firecrawl, type SearchData } from 'firecrawl';
import { toUpper } from 'ramda';
import { z } from 'zod';

import { logHeader, logInfo, logSuccess, logError, log, Icons, Colors } from './logger.js';

const to_upper_case_tool: DynamicStructuredTool = tool(
    ({ query }: Record<'query', string>): string => {
        const { name }: Record<'name', string> = tool;

        logInfo(`${name}`, Colors.BLUE);

        return toUpper(query);
    }, {
        name: 'to_upper_case_tool',
        description: 'Tool that converts a string to uppercase.',
        schema: z.object({
            query: z.string().describe('The query string to convert to uppercase.'),
        }).describe('Schema for the toUpper tool input, which requires a query string to perform the conversion.')
    }
);

const firecrawl_search_tool: DynamicStructuredTool = tool(
    async ({ query }: Record<'query', string>) => {

        logInfo(`${query}`, Colors.DARKCYAN);

        const firecrawl: Firecrawl = new Firecrawl({
            //apiKey: FIRECRAWL_API_KEY!,
            apiUrl: 'http://localhost:3002'
        });

        const result: SearchData = await firecrawl.search(query, {
            limit: 1
        });

        console.log(result);

        return result.web ?? 'n/a';
    }, {
        name: 'firecrawl_search_tool',
        description: 'Tool that searches over the internet via firecrawl.',
        schema: z.object({
            query: z.string().describe('The query string to search information on the internet.'),
        }).describe('Schema for the search tool input, which requires a query string to perform the search.')
    }
);

const chatOllamaLlm: ChatOllama = new ChatOllama({
    model: 'qwen3:1.7b',
    temperature: 0
});

export const tools: Array<DynamicStructuredTool> = [to_upper_case_tool, firecrawl_search_tool];
export const llm: Runnable<BaseLanguageModelInput, AIMessageChunk<MessageStructure<MessageToolSet>>, ChatOllamaCallOptions> = chatOllamaLlm.bindTools(tools);
