import 'dotenv/config';

import { DynamicStructuredTool } from 'langchain';

import { AIMessageChunk, type MessageStructure, MessageToolSet } from '@langchain/core/messages';
import { AIMessage } from '@langchain/core/messages';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { tool } from 'langchain/tools';
import { Firecrawl, type SearchData } from 'firecrawl';
import { toUpper, multiply } from 'ramda';
import { z } from 'zod';

import { ToolCallingLlm } from './types.ts';

import { logHeader, logInfo, logSuccess, logError, log, Icons, Colors } from './logger.js';

const triple_tool: DynamicStructuredTool = tool(
    ({ query }: Record<'query', number>): number => {
        const { name }: Record<'name', string> = triple_tool;

        logInfo(`${name}`, Colors.BLUE);

        return multiply(3, query);
    }, {
        name: 'triple_tool',
        description: 'Tool that multiplies a number by three.',
        schema: z.object({
            query: z.number().describe('The number to multiply by three.'),
        }).describe('Schema for the triple tool input, which requires a number to perform the multiplication.')
    }
);

const to_upper_case_tool: DynamicStructuredTool = tool(
    ({ query }: Record<'query', string>): string => {
        const { name }: Record<'name', string> = to_upper_case_tool;

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
        const { name }: Record<'name', string> = firecrawl_search_tool;

        logInfo(`${name}`, Colors.BLUE);

        const firecrawl: Firecrawl = new Firecrawl({
            //apiKey: FIRECRAWL_API_KEY!,
            apiUrl: 'http://localhost:3002'
        });

        const result: SearchData = await firecrawl.search(query, {
            limit: 1
        });

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
    model: 'nemotron-3.5-lightning',
    temperature: 0
});

const chatAnthropicLlm: ChatAnthropic = new ChatAnthropic({
    model: 'claude-sonnet-5-5',
    maxTokens: 16000
});

export const tools: Array<DynamicStructuredTool> = [triple_tool, to_upper_case_tool, firecrawl_search_tool];

const ollama: ToolCallingLlm = chatOllamaLlm.bindTools(tools);
const claude = chatAnthropicLlm.bindTools(tools);

export const llm: Record<'claude' | 'ollama', ToolCallingLlm> = {
    claude,
    ollama
};
