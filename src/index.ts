import 'dotenv/config';

import { ChatGroq } from '@langchain/groq';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate, ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, SystemMessage, ToolMessage, BaseMessage, type ContentBlock } from '@langchain/core/messages';
import { type StructuredToolCallInput, ToolInputParsingException } from "@langchain/core/tools";
import type { Messages } from '@langchain/langgraph';
import { TavilySearch, type TavilySearchParams, type TavilySearchResponse } from '@langchain/tavily';
import { PineconeStore } from '@langchain/pinecone';
import { Document, type DocumentInterface } from '@langchain/core/documents';
import type { VectorStoreRetriever } from '@langchain/core/vectorstores';
import {
    RunnableLambda,
    RunnableParallel,
    RunnablePassthrough,
    RunnableMap,
    Runnable,
    type RunnableConfig
} from '@langchain/core/runnables';
import { StringOutputParser, BytesOutputParser } from '@langchain/core/output_parsers';

import { createAgent, DynamicStructuredTool, toolStrategy, providerStrategy } from 'langchain';
import type { ReactAgent } from 'langchain';
import { tool } from 'langchain/tools';
import { initChatModel } from 'langchain/chat_models/universal';

import { traceable, type TraceableFunction } from 'langsmith/traceable';

import { tavily, type TavilyClient, type TavilySearchResponse as TavilySearchResponseCore } from '@tavily/core';

import { z } from 'zod';

import { Pinecone, type RecordMetadata, Index } from '@pinecone-database/pinecone';

import { Colors, type ConsoleMethod, logHeader, logInfo, logSuccess, log } from './logger.js';

const { ANTHROPIC_API_KEY, GROQ_API_KEY, PINECONE_INDEX } = process.env;

const SourceSchema: z.ZodObject = z.object({
    url: z.string().describe('The URL of the source'),
}).describe('Schema for a source used by the agent');

const AgentResponseSchema: z.ZodObject = z.object({
    answer: z.string().describe('The agent\'s answer to the query'),
    sources: z.array(SourceSchema).default([]).describe('List of sources used to generate the answer'),
}).describe('Schema for agent response with answer and sources');

const promptTemplate = new PromptTemplate({
    inputVariables: ['topic'],
    template: `Tell me a joke about: {topic}.`
});

const agentPromptTemplate = new PromptTemplate({
    inputVariables: ['topic'],
    template: 'You are an Claude Code Agent an your task is: {topic}.'
});

const chatAnthropicLlm: ChatAnthropic = new ChatAnthropic({
    apiKey: ANTHROPIC_API_KEY ?? '',
    model: 'claude-sonnet-4-5-20250929',
    temperature: 0
});

const chatOllamaLlm: ChatOllama = new ChatOllama({
    model: 'qwen3.6:27b',
    temperature: 0
});

const chatGroqLlm: ChatGroq = new ChatGroq({
    apiKey: GROQ_API_KEY ?? '',
    model: 'groq/compound'
});

const llm: ChatOllama | ChatGroq | ChatAnthropic = chatOllamaLlm || chatGroqLlm || chatAnthropicLlm;
// const stringOutputParser: StringOutputParser = new StringOutputParser();
// const runnable: Runnable = promptTemplate.pipe(llm).pipe(stringOutputParser);
//
// let result: string = await runnable.invoke({ topic: "Software Developer" });
//
// console.log(result);

const tavilySearchTool: TavilySearch = new TavilySearch({
    //tavilyApiKey: process.env.TAVILY_API_KEY ?? '',
    maxResults: 5,
    includeImages: true,
    //topic: "general",
    // includeAnswer: false,
    // includeRawContent: false,
    // includeImages: false,
    // searchDepth: "basic",
});

const search_tool_native_tavily: DynamicStructuredTool = tool(
    async ({ query }: TavilySearchParams): Promise<TavilySearchResponseCore> => {
        const tvly: TavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY ?? '' });
        const response: TavilySearchResponseCore = await tvly.search(query);
        console.log(response);

        return response;
    }, {
        name: 'search_tool_native_tavily',
        description: 'Tool that searches over the internet.',
        schema: z.object({
            query: z.string(),
        })
    }
);

const search_tool: DynamicStructuredTool = tool(
    async ({ query }: TavilySearchParams): Promise<TavilySearchResponse> => {
        const { name }: Record<'name', string> = tool;
        const input: StructuredToolCallInput = { query , name };

        console.log(`${query}`);

        return await tavilySearchTool.invoke(input);
    }, {
        name: 'search_tool',
        description: 'Tool that searches over the internet.',
        schema: z.object({
            query: z.string().describe('The query string to search for job postings or other information on the internet.'),
        }).describe('Schema for the search tool input, which requires a query string to perform the search.')
    }
);

const agent: ReactAgent = createAgent({
    model: llm,
    tools: [search_tool],
    systemPrompt: `You are a helpful assistant.`,
    //responseFormat: toolStrategy(AgentResponseSchema)
    responseFormat: toolStrategy(AgentResponseSchema, {
        toolMessageContent: 'Here is the result of the tool call:',
        handleError: (error: Error): string => {
            console.log(error);

            if (error instanceof ToolInputParsingException) {
                return "Please provide a valid input.";
            }

            return error.message;
        }
    }),
    //responseFormat: providerStrategy(AgentResponseSchema)
});

const humanMessage: HumanMessage = new HumanMessage('Search the internet for 5 job postings for an ai engineer using langchain on indeed in DACH region.');
const humanMessages: Messages = [humanMessage];

// const agentResult: Record<'messages', Array<Messages>> = await agent.invoke({ messages: humanMessages });
// const { messages: msgs }: Record<'messages', Array<Messages>> = agentResult;
// console.log(msgs);

const MAX_ITERATIONS: number = 10;
const MODEL: string = 'qwen3:1.7b';

const get_product_price_tool: DynamicStructuredTool = tool(
    async ({ product }: Record<'product', string>): Promise<number> => {
        const map: Map<string, number> = new Map<string, number>([
            ["laptop", 1299.99],
            ["keyboard", 99.99],
            ["headphone", 9.99]
        ]);

        map.set("smartphone", 999.99);

        const price: number = map.get(product) ?? 0;

        console.log(`  [${product}:::${price}]`);

        return price;
    }, {
        name: 'get_product_price_tool',
        description: 'Tool that searches for a product price.',
        schema: z.object({
            product: z.string().describe('The product to search for.'),
        }).describe('Schema for the get_product_price_tool input, which requires a product string to perform the search for the price of a product in the catalogue.')
    }
);

const apply_discount_tool: DynamicStructuredTool = tool(
    async ({ price, tier }: Record<'price', number> & Record<'tier', string>): Promise<number> => {
        const map: Map<string, number> = new Map<string, number>([ ['gold', 23], ['silver', 12], ['bronze', 5] ]);

        const currentTier: number = map.get(tier) ?? 0;
        const discount: number = Math.round(price * (1 - currentTier / 100) * 100) / 100;

        console.log(`  [${price}:::${tier}:::${discount}]`);

        return discount;
    }, {
        name: 'apply_discount_tool',
        description: 'Tool that applies a discount to a product price.',
        schema: z.object({
            price: z.number().positive().finite().describe('The price of the product.'),
            tier: z.enum(['gold', 'silver', 'bronze']).describe('The discount tier to apply.'),
        }).describe('Schema for the apply_discount_tool input, which requires a price and a discount tier to calculate the discounted price.')
    }
);

const run: TraceableFunction<(question: string) => Promise<string | Array<ContentBlock | ContentBlock.Text> | null>> = traceable(async (question: string) => {
    const tools: Array<DynamicStructuredTool> = [get_product_price_tool, apply_discount_tool];
    const toolsByName: Map<string, DynamicStructuredTool> = new Map(tools.map((t: DynamicStructuredTool)  => [t.name, t]));

    const ollamaLlm = await initChatModel(`ollama:${MODEL}`, {
        temperature: 0,
    });

    const llmWithTools = ollamaLlm.bindTools(tools);

    const messages: Array<BaseMessage> = [
        new SystemMessage(
            "You are a helpful shopping assistant. " +
            "You have access to a product catalog tool " +
            "and a discount tool.\n\n" +
            "STRICT RULES — you must follow these exactly:\n" +
            "1. NEVER guess or assume any product price. " +
            "You MUST call get_product_price_tool first to get the real price.\n" +
            "2. Only call apply_discount_tool AFTER you have received " +
            "a price from get_product_price_tool. Pass the exact price " +
            "returned by get_product_price_tool — do NOT pass a made-up number.\n" +
            "3. NEVER calculate discounts yourself using math. " +
            "Always use the apply_discount_tool tool.\n" +
            "4. If the user does not specify a discount tier, " +
            "ask them which tier to use — do NOT assume one."
        ),
        new HumanMessage(question),
        //new AIMessage("Cherry blossoms bloom..."),
    ];

    for (let i: number = 0; i < MAX_ITERATIONS; i++) {
        console.log(`\n--- Iteration ${i + 1} ---`);

        const aiMessage = await llmWithTools.invoke(messages);
        const toolCalls = aiMessage.tool_calls;

        if(!toolCalls || toolCalls.length === 0) {
            const { content } = aiMessage;
            console.log(`\nFinal Answer: ${content}`);
            return content;
        }

        const toolCall = toolCalls[0];

        if (!toolCall) {
            throw new Error("Expected a tool call but found none");
        }

        const { name: toolName, args: toolArgs, id: toolCallId } = toolCall;

        console.log(`  [Tool Selected] ${toolName} with args: ${JSON.stringify(toolArgs)}`);

        const selectedTool = toolsByName.get(toolName);

        if (!selectedTool) {
            throw new Error(`Tool '${toolName}' not found`);
        }

        const observation = await selectedTool.invoke(toolArgs);

        console.log(`  [Tool Result] ${observation}`);

        messages.push(aiMessage);
        messages.push(new ToolMessage({
            content: String(observation),
            tool_call_id: toolCallId!,
        }));
    }

    console.log('ERROR: Max iterations reached without a final answer');

    return null;
}, { name: 'LangChain Agent Loop' });


// run('What is the price of a smartphone after applying a gold discount?').then(console.log);

// ##################################################################

const embeddings: OllamaEmbeddings = new OllamaEmbeddings({
    model: "mxbai-embed-large",
    baseUrl: "http://localhost:11434"
});

const pinecone: Pinecone = new Pinecone();
const pineconeIndex: Index<RecordMetadata> = pinecone.Index(PINECONE_INDEX!);

const vectorStore: PineconeStore = await PineconeStore.fromExistingIndex(
    embeddings,
    {
        pineconeIndex
    }
);

const vectorStoreRetriever: VectorStoreRetriever<PineconeStore> = vectorStore.asRetriever({
    k: 3
});

const chatPromptTemplate: ChatPromptTemplate = ChatPromptTemplate.fromTemplate(`
    Answer the question based only on the following context:
        {context}
    
    Question: 
        {question}
    
    Provide a detailed answer:
`);

const query: string = 'What is Pinecone in machine learning?';

const human: HumanMessage = new HumanMessage(query);

function formatDocs(docs: Array<Document>): string {
    return docs
        .map((doc: Document): string => doc.pageContent)
        .join('\n\n');
}

async function retrievalChainWithoutLcel(query: string): Promise<string> {
    const docs: Array<DocumentInterface<Record<string, unknown>>> = await vectorStoreRetriever.invoke(query);
    const context: string = formatDocs(docs);

    const messages: Array<BaseMessage> = await chatPromptTemplate.formatMessages({
        context, question: human
    });

    const response: string = await llm.pipe(new StringOutputParser()).invoke(messages);

    return response;
}

// const resultWithoutLcel: string = await retrievalChainWithoutLcel(query)
// logInfo(resultWithoutLcel);

// #######################################
logHeader(`VIA LangChain Expression Language`);

type RunnableParallelFrom = {
    context:  VectorStoreRetriever<PineconeStore> | string;
    question: RunnablePassthrough | Error;
};

const stringOutputParserLcel: StringOutputParser = new StringOutputParser();
const bytesOutputParserLcel: BytesOutputParser = new BytesOutputParser();

const formatDocsRunnable: RunnableLambda<Document<Record<string, unknown>>[], string, RunnableConfig<Record<string, unknown>>> = new RunnableLambda({
    func: (docs: Document[]): string => formatDocs(docs)
});

const runnableParallel: RunnableMap = RunnableParallel.from({
    context: vectorStoreRetriever.pipe(formatDocsRunnable),
    question: new RunnablePassthrough()
});

logInfo(`${runnableParallel.getName()}`, Colors.BLUE);

const retrievalChain: Runnable = runnableParallel
    .pipe(chatPromptTemplate)
    .pipe(llm);

logInfo(`${JSON.stringify(retrievalChain.toJSON())}`, Colors.PURPLE);

const resultStr: string = await retrievalChain.pipe(stringOutputParserLcel).invoke(query);
const resultList: Uint8Array<ArrayBufferLike> = await retrievalChain.pipe(bytesOutputParserLcel).invoke(query);

logSuccess(`Result of retrieval chain with LCEL and StringOutputParser: ${resultStr}`);
log(`Result of retrieval chain with LCEL and BytesOutputParser: ${resultList}`, 'dir');
