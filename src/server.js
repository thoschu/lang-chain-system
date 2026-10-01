import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { flatten } from 'ramda';

import { runLlm } from '../dist/core.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 8008;

app.set('view engine', 'ejs');
app.set('views', path.join(dirname, 'views'));

app.use(express.static(path.join(dirname, 'public')));
app.use(express.json());

app.get('/', async (req, res) => {
    const title = 'LangChain by Tom S.';

    res.render('index', {
        title, header: 'LLM Chat'
    });
});

app.post('/api/llm', async (req, res) => {
    //const defaultQuestion = 'Was ist LangChain?';
    const defaultQuestion = 'No question given. Please repeat.';
    const { question: rawQuestion } = req.body;
    const question = typeof rawQuestion === 'string' ? rawQuestion : defaultQuestion;
    const llmResponse = await runLlm(question);
    const { content, artifacts} = llmResponse;
    const metadata = flatten(artifacts).map(doc => {
        if(doc.metadata.sourceURL) {
            return doc.metadata.sourceURL;
        }

        return 'Unknown';
    });

    //console.dir(artifacts, { depth: 3 });

    res.json({
        content,
        metadata
    });
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
