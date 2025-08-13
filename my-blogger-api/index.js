// index.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});