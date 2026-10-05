import { StateSchema, MessagesValue } from '@langchain/langgraph';

import { z } from 'zod';

export const stateAnnotation = new StateSchema({
    messages: MessagesValue,
    index: z.number()
});

export type State = typeof stateAnnotation.State;
export type StateUpdate = typeof stateAnnotation.Update;
export type Node = typeof stateAnnotation.Node;
