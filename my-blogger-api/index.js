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

// نقطة نهاية لتسجيل الدخول وإنشاء الجلسات
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        return res.status(401).json({ error: error.message });
    }
    
    const user = data.user;
    const sessionToken = crypto.randomUUID();

    await supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', user.id);

    await supabase
        .from('user_sessions')
        .insert({ user_id: user.id, session_token: sessionToken });

    return res.json({ message: 'Login successful', sessionToken, user_id: user.id });
});

// نقطة نهاية لجلب بيانات المستخدم
app.get('/get-profile', async (req, res) => {
    const { user_id: userId } = req.query;
    if (!userId) {
        return res.status(400).send('User ID is required');
    }
    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, avatar_id, subscription_start, subscription_end')
        .eq('user_id', userId)
        .single();
    if (profileError) {
        return res.status(500).json({ error: 'Error fetching user profile' });
    }
    
    // بناء رابط الصورة الرمزية هنا
    const avatarUrl = `https://vuxkgcdtardgcrgmpjeh.supabase.co/storage/v1/object/public/avatars/avatar${profile.avatar_id}.png`;

    return res.json({ ...profile, avatar_url: avatarUrl });
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
