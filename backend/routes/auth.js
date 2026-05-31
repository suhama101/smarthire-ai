const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const router = express.Router();
const { signup, login, getProfile, updateProfile } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const { getSupabaseClient } = require('../services/supabaseClient');
const { saveResetToken, getResetToken } = require('../services/db');
const { sendPasswordResetEmail } = require('../services/emailService');

const forgotPasswordSchema = z.object({
	email: z.string().email('Invalid email'),
});

const resetPasswordSchema = z.object({
	token: z.string().min(1, 'Token is required'),
	newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

function createResetLink(token) {
	return `https://smarthire-ai-lrq8.vercel.app/reset-password?token=${encodeURIComponent(token)}`;
}

// Public routes
router.post('/signup', signup);
router.post('/login', login);

router.post('/forgot-password', async (req, res) => {
	const parsed = forgotPasswordSchema.safeParse(req.body || {});

	if (!parsed.success) {
		return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
	}

	try {
		const { email } = parsed.data;
		const supabase = getSupabaseClient();
		const query = supabase.from('users').select('id, email, full_name').eq('email', email);
		const { data: user, error } = query.maybeSingle ? await query.maybeSingle() : await query.single();

		if (error) {
			console.error('Forgot password lookup error:', error);
			return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
		}

		if (user) {
			const token = crypto.randomBytes(32).toString('hex');
			const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

			await saveResetToken(user.id, token, expiresAt);

			try {
				await sendPasswordResetEmail(email, createResetLink(token));
			} catch (mailError) {
				console.error('Password reset email failed:', mailError);
			}
		}
	} catch (err) {
		console.error('Forgot password error:', err);
	}

	return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
});

router.post('/reset-password', async (req, res) => {
	const parsed = resetPasswordSchema.safeParse(req.body || {});

	if (!parsed.success) {
		return res.status(400).json({
			error: parsed.error?.issues?.[0]?.message || 'Invalid reset request.',
		});
	}

	try {
		const { token, newPassword } = parsed.data;
		const supabase = getSupabaseClient();
		const resetToken = await getResetToken(token);

		if (!resetToken) {
			return res.status(400).json({ error: 'Reset token is invalid or expired.' });
		}

		const password_hash = await bcrypt.hash(newPassword, 12);
		const { error: userUpdateError } = await supabase
			.from('users')
			.update({ password_hash })
			.eq('id', resetToken.user_id);

		if (userUpdateError) {
			return res.status(500).json({ error: userUpdateError.message || 'Could not update password.' });
		}

		const { error: tokenUpdateError } = await supabase
			.from('password_reset_tokens')
			.update({ used: true })
			.eq('token', token);

		if (tokenUpdateError) {
			return res.status(500).json({ error: tokenUpdateError.message || 'Could not finalize password reset.' });
		}

		return res.json({ message: 'Password updated successfully.' });
	} catch (err) {
		console.error('Reset password error:', err);
		return res.status(500).json({ error: err?.message || 'Could not reset password.' });
	}
});

// Protected routes
router.get('/profile', authMiddleware, getProfile);
router.patch('/profile', authMiddleware, updateProfile);

module.exports = router;