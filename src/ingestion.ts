import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';

import { Chroma } from '@langchain/community/vectorstores/chroma';
import { UnstructuredLoader } from '@langchain/community/document_loaders/fs/unstructured';
import { WebPDFLoader } from '@langchain/community/document_loaders/web/pdf';
import { Document } from '@langchain/core/documents';
import { CharacterTextSplitter, RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';

import { OllamaEmbeddings } from '@langchain/ollama';

import { Pinecone, type RecordMetadata, Index } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';

import { TavilyCrawl, TavilyExtract, TavilyMap, TavilySearch, type TavilyCrawlResponse, type TavilyExtractResult } from '@langchain/tavily';

import { Firecrawl, FirecrawlAppV1, type CrawlJob, type Document as FirecrawlDocument, type CrawlOptions } from 'firecrawl';

import { splitEvery, not } from 'ramda';

import { logHeader, logInfo, logSuccess, logError, log, Icons, Colors } from './logger.js';

const {
    PROD,
    UNSTRUCTURED_API_KEY, UNSTRUCTURED_API_URL,
    PINECONE_API_KEY, PINECONE_INDEX,
    FIRECRAWL_API_KEY,
} = process.env;

const notesTxt: string = 'src/documents/sample.txt';
const existsTxt: boolean = existsSync(notesTxt);
const isProd = PROD === 'true';

let counter: number = 1;

logHeader('DOC INGESTION PIPELINE A');

const loader: UnstructuredLoader = new UnstructuredLoader(resolve(notesTxt), {
    apiUrl: UNSTRUCTURED_API_URL ?? '',
    //strategy: 'auto',
    maxCharacters: 1000000,
    encoding: 'utf-8',
    //chunkingStrategy: 'by_title'
});

const docs: Array<Document> = await loader.load();

logInfo(`${counter++}. UnstructuredLoader loaded ${docs.length} Documents`, Colors.DARKCYAN);

if(not(isProd)) {
    log(docs);
}

const textSplitter: CharacterTextSplitter = new CharacterTextSplitter({
    chunkSize: 10,
    chunkOverlap: 0,
});

const texts: Array<Document> = await textSplitter.splitDocuments(docs);

logSuccess(`${counter++}. CharacterTextSplitter loaded and ${docs.length} Documents split to into ${texts.length} chunks.`);

if(not(isProd)) {
    log(texts);
}

const embeddings: OllamaEmbeddings = new OllamaEmbeddings({
    model: "mxbai-embed-large", //"qwen3-embedding:8b",
    baseUrl: "http://localhost:11434",
    // mxbai-embed-large: Kontextlimit 512 Tokens. LangChain sendet per Default
    // truncate=false, dann lehnt Ollama den GESAMTEN Batch (alle Chunks in einem
    // Request) ab, sobald ein einzelner Chunk zu tokendicht ist.
    truncate: true,
    maxRetries: 3
});

logInfo(`${counter++}. OllamaEmbeddings loaded with model: ${embeddings.model} and dimensions: ${embeddings.dimensions}.`, Colors.DARKCYAN);

const pinecone: Pinecone = new Pinecone();
const pineconeIndex: Index<RecordMetadata> = pinecone.Index(PINECONE_INDEX!);

const vectorStore: PineconeStore = await PineconeStore.fromExistingIndex(
    embeddings,
    {
        pineconeIndex,
        // Maximum number of batch requests to allow at once. Each batch is 1000 vectors.
        maxConcurrency: 5,
        // You can pass a namespace here too
        // namespace: "test-ns",
    }
);

logInfo(`${counter++}. Pinecone Vector Store [fromExistingIndex] loaded: ${JSON.stringify(pinecone.getConfig())}`, Colors.DARKCYAN);

// const ids: Array<string> = await vectorStore.addDocuments(texts);
//
// if(not(isProd)) {
//     log(ids);
//     log(`${Colors.CYAN}${Icons.ROCKET}\n${ids.map((id: string): string => id).join('\n')}`);
// }

// #############################################
logHeader('DOC INGESTION PIPELINE B');

// const tavilyCrawl: TavilyCrawl = new TavilyCrawl({
//     extractDepth: 'advanced',
//     // format: "markdown",
//     maxDepth: 5,
//     // maxBreadth: 50,
//     limit: 100,
//     includeImages: true,
//     allowExternal: true
// });

const firecrawl: Firecrawl = new Firecrawl({
    //apiKey: FIRECRAWL_API_KEY!,
    apiUrl: 'http://localhost:3002',
});

const crawlerName: FirecrawlAppV1 = firecrawl.v1; //tavilyCrawl.getName();

logInfo(`${counter++}. Start crawling by: ${crawlerName.apiUrl} ...`);

// const tavilyCrawlResponse: TavilyCrawlResponse = await crawl.invoke({
//     name: toolTavilyCrawl.name,
//     args: {
//         url: 'https://docs.langchain.com/',
//         instructions: "content on ai agents",
//     },
//     type: 'tool_call',
// });
//
// const tavilyCrawlResponseResults: Array<TavilyExtractResult> = tavilyCrawlResponse.results;
// const { results: crawlData }: Record<'results', Array<TavilyExtractResult>> = tavilyCrawlResponse;

// 'markdown' liefert doc.markdown - Volltext zum Chunken/Embedden.
// Das 'json'-Format waere eine LLM-Extraktion pro Seite: die self-hosted
// Instanz hat keinen LLM-Key gesetzt, verwirft dann jedes Ergebnis und
// liefert completed:0 / data:[] - ohne Fehler zu melden.
const crawlOptions: CrawlOptions = {
    limit: 10,
    scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true,
    }
};
const firecrawlResponse: CrawlJob = await firecrawl.crawl('https://docs.langchain.com/', crawlOptions);

const { data: crawlData }: Record<'data', Array<FirecrawlDocument>> = firecrawlResponse;

if(not(isProd)) {
    console.dir(crawlData);
}

logSuccess(`${counter++}. Firecrawl CrawlJob [${firecrawlResponse.status}] with ${crawlData.length} Items.`);

const documents: Array<Document> = [];

let skipped: number = 0;

// Feldnamen weichen von Tavily ab: raw_content -> markdown, url -> metadata.sourceURL
crawlData.forEach((result: FirecrawlDocument): void => {
    if (!result.markdown?.trim()) {
        skipped++;

        return;
    }

    documents.push(new Document({
        pageContent: result.markdown,
        metadata: result.metadata ?? {},
        id: randomUUID()
    }));
});

if (skipped > 0) {
    logInfo(`${counter++}. ${skipped} Treffer ohne Textinhalt übersprungen.`, Colors.YELLOW);
}

if(not(isProd)) {
    console.dir(documents);
}

logSuccess(`${counter++}. ${documents.length} von ${crawlData.length} Treffern nutzbar.`);

logInfo(`${counter++}. Splitting documents...`);

// mxbai-embed-large hat ein Kontextlimit von 512 Tokens (~1800 Zeichen).
// chunkSize zaehlt Zeichen, nicht Tokens -> mit Reserve unter dem Limit bleiben.
// LangChain setzt truncate=false, d.h. Ollama lehnt zu lange Chunks mit
// "input length exceeds the context length" ab statt sie still zu kürzen.
const splitter: RecursiveCharacterTextSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 100,
});

logInfo(`${counter++}. RecursiveCharacterTextSplitter loaded: ${splitter.getName()}`, Colors.GREEN);

const splittedDocuments: Array<Document<Record<string, unknown>>> = await splitter.splitDocuments(documents);

if(not(isProd)) {
    log(splittedDocuments);
}

logSuccess(`${counter++}. ${splittedDocuments.length} Chunks erzeugt aus ${documents.length} Dokumenten.`);

const chromaVectorStore: Chroma = new Chroma(
    embeddings,
    {
        collectionName: 'collection-1',
        url: 'http://localhost:8000'
    }
);

logInfo(`${counter++}. Embedding into Chroma...`);

function indexDocumentsAsync<T = unknown>(splittedDocuments: Array<Document<Record<string, T>>>, chunkSize: number = 100): Array<Array<Document<Record<string, T>>>> {
    logHeader('VECTOR STORE INGESTION PHASE');
    logInfo(`> ${counter++}. VectorStore indexing: Preparing to add ${splittedDocuments.length}`, Colors.DARKCYAN);

    const batches: Array<Array<Document<Record<string, T>>>> = splitEvery(chunkSize, splittedDocuments);

    logInfo(`> ${counter++}. VectorStore indexing: Split into ${batches.length} batches of ${chunkSize} documents each.`);

    return batches;
}

const chunkSize: number = 20;
const splittedDocumentsList: Array<Array<Document<Record<string, unknown>>>> = indexDocumentsAsync(splittedDocuments, chunkSize);

if(not(isProd)) {
    console.dir(splittedDocumentsList, { depth: 3 });
}

const chromaVectorStoreIds: Array<void | Array<string>> = await Promise.all<Array<Promise<void | Array<string>>>>(
    Iterator
        .from<Array<Document<Record<string, unknown>>>>(splittedDocumentsList)
            .map<Promise<void | Array<string>>>(
                (batch: Array<Document<Record<string, unknown>>>): Promise<void | Array<string>> => chromaVectorStore
                    .addDocuments(batch)
                        .then((res: Array<string>): void=> logSuccess(`${counter++} VectorStore indexing: Successfully added batch ${chunkSize/splittedDocumentsList.length} (${batch.length}) documents`))
                            .catch((err: unknown): void => logError(`${counter++} VectorStore indexing:: Failed to add batch ${chunkSize}: ${err}`))
            ).toArray()
);

if(not(isProd)) {
    log(chromaVectorStoreIds);
}

logHeader(`PIPELINE COMPLETE`);
logSuccess(`${counter++} ${chromaVectorStoreIds.length}[${splittedDocumentsList.length}] ChunkBatches of (${splittedDocuments.length}) Documents in Chroma gespeichert.`);
logInfo(`Documentation ingestion pipelines finished successfully...`);
logInfo(`Summary:`, Colors.YELLOW);
logInfo(`   - ${Colors.BOLD}Documents extracted: ${documents.length}`);
logInfo(`   - Chunks created: ${splittedDocuments.length}`);

const memoryStore: MemoryVectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
logSuccess(`Docs im Memory-Store: ${JSON.stringify(memoryStore.toJSON())} `);
