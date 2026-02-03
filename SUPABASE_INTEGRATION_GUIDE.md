# 🚀 Supabase Integration Guide

## 📋 Overview

This guide will help you integrate Supabase into your Smart Public Health Command System to add:
- **PostgreSQL Database**: Powerful relational database with real-time updates
- **Authentication**: Secure user login for Admin, Health Workers, and Citizens
- **Row Level Security**: Advanced security policies
- **Auto REST API**: Instant backend API generation
- **Real-time Subscriptions**: Live data updates across all users

---

## 🎯 Why Supabase Over Firebase?

| Feature | Supabase | Firebase |
|---------|----------|----------|
| Database | PostgreSQL (SQL) | Firestore (NoSQL) |
| Free Tier Database | 500MB | 1GB |
| Free Tier Bandwidth | 2GB | 10GB/month |
| Open Source | ✅ Yes | ❌ No |
| Self-hostable | ✅ Yes | ❌ No |
| Complex Queries | ✅ SQL | Limited |
| Real-time | ✅ Yes | ✅ Yes |

---

## 🚀 Step 1: Create Supabase Project

1. **Go to**: https://supabase.com/
2. **Click** "Start your project" or "Sign In"
3. **Sign up** with GitHub (recommended) or Email
4. **Click** "New Project"
5. **Fill in**:
   - **Organization**: Create new or use existing
   - **Project Name**: `Smart Health System`
   - **Database Password**: Choose a strong password (SAVE THIS!)
   - **Region**: Choose closest to you (e.g., `Southeast Asia (Singapore)` for India)
   - **Pricing Plan**: Free
6. **Click** "Create new project"
7. **Wait** 2-3 minutes for setup to complete

---

## 🗄️ Step 2: Create Database Tables

Once your project is ready:

### A. Go to Table Editor

1. Click **"Table Editor"** in the left sidebar
2. Click **"Create a new table"**

### B. Create Tables

#### **Table 1: wards**

Click "New table" and create:

- **Table name**: `wards`
- **Enable Row Level Security (RLS)**: ✅ Check this
- **Columns**:

| Name | Type | Default | Primary | Nullable |
|------|------|---------|---------|----------|
| id | text | - | ✅ | ❌ |
| name | text | - | ❌ | ❌ |
| population | int8 | - | ❌ | ❌ |
| coordinates | jsonb | - | ❌ | ❌ |
| total_cases | int8 | 0 | ❌ | ❌ |
| active_alerts | int8 | 0 | ❌ | ❌ |
| created_at | timestamptz | now() | ❌ | ❌ |

#### **Table 2: cases**

Create another table:

- **Table name**: `cases`
- **Enable RLS**: ✅
- **Columns**:

| Name | Type | Default | Primary | Nullable |
|------|------|---------|---------|----------|
| id | uuid | gen_random_uuid() | ✅ | ❌ |
| ward_id | text | - | ❌ | ❌ |
| disease | text | - | ❌ | ❌ |
| patient_age | int8 | - | ❌ | ❌ |
| patient_gender | text | - | ❌ | ❌ |
| reported_by | text | - | ❌ | ✅ |
| created_at | timestamptz | now() | ❌ | ❌ |

#### **Table 3: alerts**

- **Table name**: `alerts`
- **Enable RLS**: ✅
- **Columns**:

| Name | Type | Default | Primary | Nullable |
|------|------|---------|---------|----------|
| id | uuid | gen_random_uuid() | ✅ | ❌ |
| ward_id | text | - | ❌ | ❌ |
| disease | text | - | ❌ | ❌ |
| severity | text | - | ❌ | ❌ |
| cases_per_week | int8 | - | ❌ | ❌ |
| is_active | bool | true | ❌ | ❌ |
| created_at | timestamptz | now() | ❌ | ❌ |

#### **Table 4: hospitals**

- **Table name**: `hospitals`
- **Enable RLS**: ✅
- **Columns**:

| Name | Type | Default | Primary | Nullable |
|------|------|---------|---------|----------|
| id | uuid | gen_random_uuid() | ✅ | ❌ |
| name | text | - | ❌ | ❌ |
| ward_id | text | - | ❌ | ❌ |
| coordinates | jsonb | - | ❌ | ❌ |
| total_beds | int8 | - | ❌ | ❌ |
| available_beds | int8 | - | ❌ | ❌ |
| updated_at | timestamptz | now() | ❌ | ❌ |

#### **Table 5: user_profiles**

- **Table name**: `user_profiles`
- **Enable RLS**: ✅
- **Columns**:

| Name | Type | Default | Primary | Nullable |
|------|------|---------|---------|----------|
| id | uuid | - | ✅ | ❌ |
| email | text | - | ❌ | ✅ |
| role | text | 'citizen' | ❌ | ❌ |
| name | text | - | ❌ | ✅ |
| ward_id | text | - | ❌ | ✅ |
| created_at | timestamptz | now() | ❌ | ❌ |

---

## 🔐 Step 3: Set Up Row Level Security (RLS)

### A. Enable Authentication

1. Click **"Authentication"** in the left sidebar
2. Click **"Policies"** tab (under Table Editor)

### B. Add RLS Policies

For each table, click on it, then "Add RLS policy". Here are recommended policies:

#### **For `cases` table:**

**Policy 1: Allow public read**
- Policy name: `Enable read access for all users`
- Allowed operation: SELECT
- Target roles: public
- USING expression: `true`

**Policy 2: Allow authenticated insert**
- Policy name: `Enable insert for authenticated users`
- Allowed operation: INSERT
- Target roles: authenticated
- WITH CHECK expression: `true`

#### **For `alerts` table:**

**Policy 1: Public read**
- Policy name: `Enable read access for all users`
- Allowed operation: SELECT
- Target roles: public
- USING expression: `true`

**Policy 2: Authenticated write**
- Policy name: `Enable write for authenticated users`
- Allowed operation: ALL
- Target roles: authenticated
- USING expression: `true`

#### **For `wards` and `hospitals` tables:**

**Public read, authenticated write** (same as alerts)

#### **For `user_profiles` table:**

**Policy: Users can read their own profile**
- Policy name: `Users can view own profile`
- Allowed operation: SELECT
- Target roles: authenticated
- USING expression: `auth.uid() = id`

---

## 📦 Step 4: Get Your Supabase Credentials

1. Click **"Settings"** (gear icon) in the left sidebar
2. Click **"API"** under Project Settings
3. **Copy these values**:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGc...` (long string)

**Keep these safe!** You'll need them in the next step.

---

## 💻 Step 5: Add Supabase to Your App

### A. Create Supabase Config File

I'll create `supabase-config.js` for you once you provide your credentials.

### B. Add Supabase SDK to `index.html`

Add this script tag in your HTML **before** your app.js:

```html
<!-- Supabase SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Your Supabase config -->
<script src="supabase-config.js"></script>

<!-- Your app logic -->
<script src="app.js"></script>
```

---

## 🔧 Step 6: Initialize Supabase

### Example `supabase-config.js`:

```javascript
// Supabase Configuration
const SUPABASE_URL = 'YOUR_PROJECT_URL'; // https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY'; // eyJhbGc...

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export globally for easy access
window.supabase = supabase;

console.log('✅ Supabase initialized');
```

---

## 📝 Step 7: Update Your App Logic

### Example: Submit Case to Supabase

**Old code (local storage):**
```javascript
function submitCaseReport(disease, age, gender, wardId) {
  cases.push({
    disease,
    age,
    gender,
    wardId,
    timestamp: Date.now()
  });
}
```

**New code (Supabase):**
```javascript
async function submitCaseReport(disease, age, gender, wardId) {
  try {
    const { data, error } = await supabase
      .from('cases')
      .insert([
        { 
          ward_id: wardId,
          disease: disease,
          patient_age: parseInt(age),
          patient_gender: gender,
          reported_by: (await supabase.auth.getUser()).data.user?.email || 'anonymous'
        }
      ])
      .select();

    if (error) throw error;

    console.log('✅ Case submitted:', data);
    
    // Update ward statistics
    await updateWardCases(wardId);
    
    // Check for alerts
    await checkAlertThresholds(wardId, disease);
    
    return data[0];
  } catch (error) {
    console.error('❌ Error submitting case:', error);
    alert('Failed to submit case: ' + error.message);
    throw error;
  }
}
```

### Example: Real-time Data Subscriptions

```javascript
// Listen to new cases in real-time
function setupRealtimeCaseUpdates() {
  const casesSubscription = supabase
    .channel('public:cases')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'cases' },
      (payload) => {
        console.log('New case reported!', payload.new);
        updateDashboardWithNewCase(payload.new);
        playNotificationSound();
      }
    )
    .subscribe();

  console.log('✅ Real-time subscription active');
}

// Listen to alert changes
function setupRealtimeAlertUpdates() {
  supabase
    .channel('public:alerts')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'alerts' },
      (payload) => {
        console.log('Alert updated!', payload);
        refreshAlertsList();
      }
    )
    .subscribe();
}

// Call when app loads
setupRealtimeCaseUpdates();
setupRealtimeAlertUpdates();
```

### Example: Fetch Ward Data

```javascript
async function loadWards() {
  try {
    const { data: wards, error } = await supabase
      .from('wards')
      .select('*')
      .order('name');

    if (error) throw error;

    console.log('✅ Loaded wards:', wards);
    return wards;
  } catch (error) {
    console.error('❌ Error loading wards:', error);
    return [];
  }
}
```

### Example: Get Active Alerts

```javascript
async function getActiveAlerts(wardId = null) {
  try {
    let query = supabase
      .from('alerts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    // Filter by ward if specified
    if (wardId) {
      query = query.eq('ward_id', wardId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('❌ Error fetching alerts:', error);
    return [];
  }
}
```

---

## 🔐 Step 8: Add Authentication

### Enable Email Auth in Supabase

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Configure email templates (optional)

### Login Functions

```javascript
// Sign up new user
async function signUp(email, password, role = 'citizen') {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) throw error;

    // Create user profile
    await supabase.from('user_profiles').insert([
      {
        id: data.user.id,
        email: email,
        role: role,
        name: email.split('@')[0]
      }
    ]);

    console.log('✅ User signed up:', data);
    return data;
  } catch (error) {
    console.error('❌ Signup error:', error);
    alert('Signup failed: ' + error.message);
  }
}

// Login existing user
async function login(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) throw error;

    // Get user role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    console.log('✅ Logged in as:', profile.role);

    // Redirect based on role
    if (profile.role === 'admin') {
      showAdminDashboard();
    } else if (profile.role === 'healthworker') {
      showHealthWorkerPanel();
    } else {
      showCitizenPanel();
    }

    return data;
  } catch (error) {
    console.error('❌ Login error:', error);
    alert('Login failed: ' + error.message);
  }
}

// Logout
async function logout() {
  const { error } = await supabase.auth.signOut();
  if (!error) {
    showLoginScreen();
  }
}

// Monitor auth state
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session.user.email);
  } else if (event === 'SIGNED_OUT') {
    console.log('User signed out');
    showLoginScreen();
  }
});
```

---

## 📊 Step 9: Seed Initial Data (Optional)

### Add Sample Wards

Go to Table Editor → wards → Insert Row, or use SQL Editor:

```sql
INSERT INTO wards (id, name, population, coordinates, total_cases, active_alerts)
VALUES 
  ('w1', 'Ward 1 - Colaba', 150000, '[[18.9067, 72.8147], [18.9100, 72.8200]]'::jsonb, 45, 2),
  ('w2', 'Ward 2 - Bandra', 180000, '[[19.0544, 72.8406], [19.0600, 72.8500]]'::jsonb, 32, 1),
  ('w3', 'Ward 3 - Andheri', 220000, '[[19.1136, 72.8697], [19.1200, 72.8800]]'::jsonb, 28, 0);
```

---

## 🎯 Step 10: Advanced Features

### A. Create Database Function for Auto-Alert Generation

Go to **SQL Editor** and run:

```sql
CREATE OR REPLACE FUNCTION check_and_create_alert(
  p_ward_id TEXT,
  p_disease TEXT
)
RETURNS void AS $$
DECLARE
  v_cases_count INT;
  v_ward_population INT;
  v_cases_per_100k NUMERIC;
  v_severity TEXT;
BEGIN
  -- Get ward population
  SELECT population INTO v_ward_population
  FROM wards WHERE id = p_ward_id;

  -- Count cases in last 7 days
  SELECT COUNT(*) INTO v_cases_count
  FROM cases
  WHERE ward_id = p_ward_id
    AND disease = p_disease
    AND created_at > NOW() - INTERVAL '7 days';

  -- Calculate rate per 100k
  v_cases_per_100k := (v_cases_count::NUMERIC / v_ward_population) * 100000;

  -- Determine severity (example thresholds for dengue)
  IF p_disease = 'dengue' THEN
    IF v_cases_per_100k >= 25 THEN
      v_severity := 'critical';
    ELSIF v_cases_per_100k >= 10 THEN
      v_severity := 'warning';
    ELSE
      RETURN; -- No alert needed
    END IF;
  END IF;

  -- Create or update alert
  INSERT INTO alerts (ward_id, disease, severity, cases_per_week, is_active)
  VALUES (p_ward_id, p_disease, v_severity, v_cases_count, true)
  ON CONFLICT (ward_id, disease) 
  DO UPDATE SET 
    severity = v_severity,
    cases_per_week = v_cases_count,
    is_active = true;

END;
$$ LANGUAGE plpgsql;
```

### B. Call Function from JavaScript

```javascript
async function checkAlertThresholds(wardId, disease) {
  const { data, error } = await supabase
    .rpc('check_and_create_alert', {
      p_ward_id: wardId,
      p_disease: disease
    });

  if (error) console.error('Error checking alerts:', error);
}
```

---

## ✅ Complete Integration Checklist

- [ ] Create Supabase project
- [ ] Create database tables (wards, cases, alerts, hospitals, user_profiles)
- [ ] Enable Row Level Security policies
- [ ] Get Project URL and anon key
- [ ] Add Supabase SDK to HTML
- [ ] Create supabase-config.js
- [ ] Update case submission function
- [ ] Add real-time subscriptions
- [ ] Implement authentication
- [ ] Test locally
- [ ] Deploy to GitHub Pages

---

## 🎁 Benefits After Supabase Integration

✅ **PostgreSQL power** - Complex queries, joins, transactions  
✅ **Real-time updates** - Instant data sync across all users  
✅ **Row Level Security** - Enterprise-grade data protection  
✅ **Auto REST API** - No backend code needed  
✅ **SQL flexibility** - Use SQL for complex analytics  
✅ **Generous free tier** - 500MB database, unlimited API requests  
✅ **Open source** - Self-host if needed  

---

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [JavaScript Client Library](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Real-time Subscriptions](https://supabase.com/docs/guides/realtime)

---

**Ready to implement? Share your Supabase Project URL and anon key, and I'll create all the files!** 🚀
