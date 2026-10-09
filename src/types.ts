import { StateSchema, MessagesValue } from '@langchain/langgraph';
import type { Runnable } from '@langchain/core/runnables';
import type { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import type { BaseChatModelCallOptions } from '@langchain/core/language_models/chat_models';
import type { AIMessageChunk, MessageStructure, MessageToolSet, BaseMessage, MessageType } from '@langchain/core/messages';

import { z } from 'zod';

export const stateAnnotation = new StateSchema({
    messages: MessagesValue,
    value: z.number()
});

export type State = typeof stateAnnotation.State;
export type StateUpdate = typeof stateAnnotation.Update;
export type Node = typeof stateAnnotation.Node;
export type ToolCallingLlm = Runnable<BaseLanguageModelInput, AIMessageChunk<MessageStructure<MessageToolSet>>, BaseChatModelCallOptions>;
