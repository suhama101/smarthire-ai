require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');

const cors = require('cors');



const authRoutes = require('./routes/auth');
const analyzeRoutes = require('./routes/analyze');
const debugRoutes = require('./routes/debug');

const { isAnthropicConfigured } = require('./services/claudeService');

const { seedDemoDataIfEmpty } = require('./services/db');

const PORT = Number(process.env.PORT) || 5000;

const NODE_ENV = process.env.NODE_ENV || 'development';

function normalizeOrigin(origin) {
	return String(origin || '').trim().replace(/\/$/, '');
}



function getAllowedOrigins() {

	const rawOrigins = String(process.env.CORS_ORIGINS || '').trim();

	if (!rawOrigins) {

		return NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

	}



	return rawOrigins.split(',').map((origin) => normalizeOrigin(origin)).filter(Boolean);

}



const app = express();

app.disable('x-powered-by');



const allowedOrigins = getAllowedOrigins();

app.use(cors({
	credentials: false,

	origin(origin, callback) {

		if (!origin) {

			return callback(null, true);

		}



		const normalizedOrigin = normalizeOrigin(origin);

		if (allowedOrigins.includes(normalizedOrigin)) {

			return callback(null, true);

		}



		if (NODE_ENV !== 'production' && allowedOrigins.length === 0) {

			return callback(null, true);

		}



		return callback(new Error('CORS origin not allowed'));

	},

}));

app.use(express.json({ limit: '10mb' }));



app.get('/', (req, res) => {

	res.json({

		name: 'SmartHire AI Backend',

		status: 'ok',

		endpoints: {

			health: '/api/health',

			analyze: '/api/analyze',

		},

	});

});



app.get('/api/health', (req, res) => {

	res.json({ status: 'ok', timestamp: new Date().toISOString() });

});



app.use('/api/auth', authRoutes);



app.use('/api/analyze', analyzeRoutes);



app.use('/api/debug', debugRoutes);



app.use((req, res) => {

	res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });

});



app.use((err, req, res, next) => {

	const status = Number(err?.status) || 500;

	const isOperational = status >= 400 && status < 500;



	if (NODE_ENV !== 'production' || !isOperational) {

		console.error(err);

	}



	if (err?.code === 'LIMIT_FILE_SIZE') {

		return res.status(413).json({

			error: 'Uploaded file is too large.',

			code: 'FILE_TOO_LARGE',

		});

	}



	if (err?.message === 'CORS origin not allowed') {

		return res.status(403).json({

			error: 'Request origin is not allowed.',

			code: 'CORS_BLOCKED',

		});

	}



	const message = NODE_ENV === 'production' && status >= 500

		? 'Internal server error'

		: (err?.message || 'Internal server error');



	return res.status(status).json({

		error: message,

		code: err?.code || 'SERVER_ERROR',

	});

});



if (require.main === module) {
	app.listen(PORT, () => {

	console.log(`SmartHire backend running on port ${PORT}`);



	if (process.env.SMART_HIRE_SEED_DEMO === '1') {

		seedDemoDataIfEmpty('demo-user')

			.then((result) => {

				if (result?.seeded) {

					console.log(`Seeded demo analysis in Supabase: ${result.analysisId}`);

				}

			})

			.catch((err) => {

				console.error('Failed to seed demo data', err);

			});

	}



	if (!isAnthropicConfigured()) {

		console.warn('GROQ_API_KEY is missing or empty. SmartHire AI will use fallback heuristics until Groq is configured.');

	}

	});
}

module.exports = app;