import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://hfglwbcxtaskzarlpllk.supabase.co';
const supabaseAnonKey = 'sb_publishable_O1OUfGj5n_JTNXyAfG1xgA_r_EEgtfd';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});