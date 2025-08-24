// index.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// نقطة نهاية لتسجيل الدخول والتحقق من الجلسات
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        return res.status(401).json({ error: error.message });
    }
    
    const user = data.user;
    const sessionToken = crypto.randomUUID();

    // حذف الجلسات القديمة للمستخدم
    await supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', user.id);

    // إنشاء جلسة جديدة
    await supabase
        .from('user_sessions')
        .insert({ user_id: user.id, session_token: sessionToken });

    return res.json({ message: 'Login successful', sessionToken, user_id: user.id });
});

// نقطة نهاية للتحقق من حالة الاشتراك
app.post('/check-premium', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const { data, error } = await supabase
        .from('premium_users_view')
        .select('premium_access')
        .eq('user_id', userId)
        .single();

    if (error) {
        return res.status(500).json({ error: 'Error checking premium status' });
    }

    return res.json({ isPremium: data ? data.premium_access : false });
});

// نقطة نهاية لتحميل الملفات بشكل آمن
app.get('/download-file', async (req, res) => {
    const { user_id: userId, session_token: sessionToken } = req.query;

    if (!userId || !sessionToken) {
        return res.status(401).send('Unauthorized: Missing credentials');
    }

    // تحقق من صلاحية الجلسة
    const { data: sessionData } = await supabase
        .from('user_sessions')
        .select('user_id')
        .eq('session_token', sessionToken)
        .single();

    if (!sessionData || sessionData.user_id !== userId) {
        return res.status(401).send('Unauthorized: Invalid session');
    }

    // تحقق من أن المستخدم مميز
    const { data: premiumStatus } = await supabase
        .from('premium_users_view')
        .select('premium_access')
        .eq('user_id', userId)
        .single();

    if (premiumStatus && premiumStatus.premium_access) {
        const filePath = path.join(__dirname, 'files', 'your-file.zip');
        res.download(filePath, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).send('Could not download the file.');
            }
        });
    } else {
        res.status(403).send('Access Denied: Not a premium user');
    }
});

// -- -- -- -- -- -- -- -- -- -- -- -- -- --
// نقاط النهاية الجديدة للملف الشخصي
// -- -- -- -- -- -- -- -- -- -- -- -- -- --

// نقطة نهاية لجلب بيانات المستخدم
app.get('/get-profile', async (req, res) => {
    const userId = req.headers['user_id'];
    if (!userId) {
        return res.status(400).send('User ID is required');
    }
    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, avatar_id, subscription_start, subscription_end, premium_access')
        .eq('user_id', userId)
        .single();
    if (profileError) {
        return res.status(500).json({ error: 'Error fetching user profile' });
    }
    return res.json(profile);
});

// نقطة نهاية لتحديث بيانات المستخدم
app.post('/update-profile', async (req, res) => {
    const { userId, firstName, lastName, avatarId } = req.body;
    if (!userId) {
        return res.status(400).send('User ID is required');
    }
    const { data, error } = await supabase
        .from('user_profiles')
        .update({
            first_name: firstName,
            last_name: lastName,
            avatar_id: avatarId
        })
        .eq('user_id', userId);
    if (error) {
        return res.status(500).json({ error: 'Error updating profile' });
    }
    return res.json({ message: 'Profile updated successfully' });
});

app.listen(port, () => {
    console.log(`API running on port ${port}`);
});
