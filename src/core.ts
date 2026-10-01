import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { createAgent, DynamicStructuredTool, type BuiltInState, type ReactAgent, type InferAgentState } from 'langchain';
import { tool } from 'langchain/tools';
import { initChatModel, ConfigurableModel } from 'langchain/chat_models/universal';

import { Chroma } from '@langchain/community/vectorstores/chroma';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, BaseMessage, type ContentBlock } from '@langchain/core/messages';
import { OllamaEmbeddings } from '@langchain/ollama';
import type { VectorStoreRetriever } from '@langchain/core/vectorstores';
import { Document, type DocumentInterface } from '@langchain/core/documents';

import { z } from 'zod';
import { has, last, not, equals } from 'ramda';

import { logHeader, logInfo, logSuccess, logError, log, Icons, Colors } from './logger.js';

const { env } = process;
const { PROD } = env;
const isProd: boolean = equals<string>(PROD ?? '', 'true');
const MODEL: string = 'qwen3:1.7b';

logHeader('INIT CORE');

const embeddings: OllamaEmbeddings = new OllamaEmbeddings({
    model: 'mxbai-embed-large', //"qwen3-embedding:8b",
    baseUrl: 'http://localhost:11434',
    // mxbai-embed-large: Kontextlimit 512 Tokens. LangChain sendet per Default
    // truncate=false, dann lehnt Ollama den GESAMTEN Batch (alle Chunks in einem
    // Request) ab, sobald ein einzelner Chunk zu tokendicht ist.
    truncate: true,
    maxRetries: 3
});

logInfo(`OllamaEmbeddings loaded ${embeddings.model}`, Colors.DARKCYAN);

if(not(isProd)) console.dir(embeddings, { depth: 3 });

const chromaVectorStore: Chroma = new Chroma(
    embeddings,
    {
        collectionName: 'collection-1',
        url: 'http://localhost:8000'
    }
);

logInfo(`Chroma loaded ${chromaVectorStore.url}`, Colors.DARKCYAN);

if(not(isProd)) console.dir(chromaVectorStore, { depth: 3 });

const llm: ConfigurableModel = await initChatModel(`ollama:${MODEL}`, {
    temperature: 0,
});

logInfo(`LLM loaded ${llm.getName()}`, Colors.DARKCYAN);

if(not(isProd)) console.dir(llm, { depth: 3 });

const docsRetriever: VectorStoreRetriever<Chroma> = chromaVectorStore.asRetriever({
    k: 6
});

logInfo(`VectorStoreRetriever with Chroma loaded ${docsRetriever.getName()}`, Colors.DARKCYAN);

if(not(isProd)) console.dir(docsRetriever, { depth: 3 });

const retrieve_content_and_artifact: DynamicStructuredTool = tool(
    async ({ query }: Record<'query', string>): Promise<[string, Array<DocumentInterface<Record<string, unknown>>>]> => {
        const artifact: Array<DocumentInterface<Record<string, unknown>>> = await docsRetriever.invoke(query);

        const content: string = Iterator
            .from<DocumentInterface<Record<string, unknown>>>(artifact)
            .map<string>((doc: Document, index: number): string => {
                const pageContent: string = doc.pageContent;
                const metadata: Record<string, unknown> = doc.metadata;
                const source: unknown = metadata.source ?? metadata.sourceURL ?? metadata.url;

                return `Content: ${pageContent}\n\nSource: ${source ?? 'Unknown'}`
            })
            .toArray()
            .join('\n\n');

        logSuccess(`TOOL CALL: ${query}`);

        return [ content, artifact ];
    }, {
        name: 'retrieve_content_and_artifact',
        description: 'Retrieve relevant documentation to help answer user queries about LangChain.',
        schema: z.object({
            query: z.string(),
        }),
        responseFormat: 'content_and_artifact'
    }
);

logInfo(`DynamicStructuredTool created ${retrieve_content_and_artifact.getName()}`, Colors.DARKCYAN);

if(not(isProd)) console.dir(retrieve_content_and_artifact, { depth: 3 });

const content: string = ` You are a helpful AI assistant that answers questions about LangChain documentation.
    You have access to a tool that retrieves relevant documentation.
    Use the tool to find relevant information before answering questions.
    Always cite the sources you use in your answers.
    If you cannot find the answer in the retrieved documentation, say so.
`;
const systemPrompt: SystemMessage = new SystemMessage({ content });

logInfo(`SystemPrompt created ${systemPrompt.name}`, Colors.DARKCYAN);

if(not(isProd)) console.dir(systemPrompt, { depth: 3 });

export const agent: ReactAgent = createAgent({
    model: llm,
    tools: [
        retrieve_content_and_artifact
    ],
    systemPrompt
});

logInfo(`ReactAgent created`, Colors.DARKCYAN);

if(not(isProd)) console.dir(agent, { depth: 3 });

export async function runLlm(query: string): Promise<Record<'content', string | Array<ContentBlock | Text> | undefined> & Record<'artifacts', Array<Array<DocumentInterface<Record<string, unknown>>>>>> {
    // const aiMessage: AIMessage = new AIMessage({
    //     content: [],
    //     tool_calls: [{
    //         name: 'search_tool',
    //         args: {
    //             location: 'DACH'
    //         },
    //         id: '1234567890'
    //     }]
    // });

    // const toolMessage: ToolMessage = new ToolMessage({
    //     content: 'Here is the result of the tool call:',
    //     tool_call_id: '1234567890'
    // });

    const humanMessage: HumanMessage = new HumanMessage({
        content: query,
        name: 'user-' + randomUUID()
    });

    const messages: Array<BaseMessage> = [humanMessage];

    const agentState: BuiltInState & InferAgentState<typeof agent> = await agent.invoke({ messages });

    const { messages: agentStateMessages }: Record<'messages', Array<BaseMessage>> = agentState;

    const answerMessage: BaseMessage | undefined = last<BaseMessage>(agentStateMessages);

    const messageContent: string | Array<ContentBlock | Text> | undefined = answerMessage?.content;

    const artifacts: Array<Array<DocumentInterface<Record<string, unknown>>>> = [];

    agentStateMessages.forEach((message: BaseMessage): void => {
        if(message instanceof ToolMessage) {
            const hasArtifact: (toolMessage: ToolMessage) => boolean = has<'artifact'>('artifact');

            if(hasArtifact(message)) {
                const artifactList: Array<DocumentInterface<Record<string, unknown>>> = message.artifact;

                artifacts.push(artifactList);
            }
        }
    });

    return { content: messageContent, artifacts };
}
