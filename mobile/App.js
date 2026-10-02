import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const PAYMENT_METHODS = ['Cash', 'Navi', 'GPay', 'PhonePe', 'Paytm', 'YONO', 'ICICI', 'Overseas', 'Debit Card', 'Credit Card', 'Bank Transfer', 'Other'];
const BRAND = '#4f6bff';
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const money = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
const methodLabel = (value) =>
  ['Navi', 'GPay', 'PhonePe', 'Paytm', 'YONO', 'ICICI', 'Overseas'].includes(value)
    ? `UPI · ${value}`
    : value || 'Cash';

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) throw new Error(result.message || 'Unable to connect to SpendWise');
  return result.data;
}

const initialExpense = () => ({
  item: '', amount: '', paymentMethod: 'Cash', hasSubtypes: false,
  subtypes: [{ type: '', amount: '', paymentMethod: 'Cash' }],
});
const initialMessage = () => ({
  contactName: '', channel: 'email', email: '', phone: '+91', message: '',
  frequency: 'once', date: tomorrow(), time: '09:00', recipientConsented: false,
});

export default function App() {
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? darkTheme : lightTheme;
  const styles = makeStyles(theme);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [screen, setScreen] = useState('Overview');
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [messageStatus, setMessageStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState(initialExpense);
  const [incomeForm, setIncomeForm] = useState({ source: '', amount: '', date: today() });
  const [budgetForm, setBudgetForm] = useState({ month: String(new Date().getMonth() + 1), limit: '' });
  const [reminderForm, setReminderForm] = useState({ title: '', amount: '', dueDate: today() });
  const [messageForm, setMessageForm] = useState(initialMessage);

  useEffect(() => {
    SecureStore.getItemAsync('spendwise-token')
      .then(async (savedToken) => {
        if (!savedToken) return;
        try {
          const profile = await request('/auth/me', { token: savedToken });
          setToken(savedToken);
          setUser(profile);
        } catch {
          await SecureStore.deleteItemAsync('spendwise-token');
        }
      })
      .finally(() => setBooting(false));
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const now = new Date();
      let next = [];
      if (screen === 'Overview') {
        const [monthSummary, recent] = await Promise.all([
          request(`/dashboard/summary?month=${now.getMonth() + 1}&year=${now.getFullYear()}`, { token }),
          request('/expenses?month=' + (now.getMonth() + 1) + '&year=' + now.getFullYear(), { token }),
        ]);
        setSummary(monthSummary);
        next = recent.slice(0, 6);
      } else if (screen === 'Expenses') {
        next = await request('/expenses', { token });
      } else if (screen === 'Income') {
        next = await request(`/income?month=${now.getMonth() + 1}&year=${now.getFullYear()}`, { token });
      } else if (screen === 'Budgets') {
        next = await request(`/budgets?year=${now.getFullYear()}`, { token });
      } else if (screen === 'Reminders') {
        next = await request('/reminders', { token });
      } else if (screen === 'Scheduled messages') {
        const [messages, status] = await Promise.all([
          request('/messages', { token }),
          request('/messages/status', { token }),
        ]);
        next = messages;
        setMessageStatus(status);
      } else if (screen === 'Reports') {
        next = await request(`/reports/yearly?year=${now.getFullYear()}`, { token });
      }
      setData(next || []);
    } catch (error) {
      Alert.alert('Could not load data', error.message);
    } finally {
      setLoading(false);
    }
  }, [screen, token]);

  useEffect(() => { load(); }, [load]);

  const signIn = async () => {
    try {
      const result = await request(`/auth/${authMode}`, {
        method: 'POST',
        body: authMode === 'register'
          ? authForm
          : { email: authForm.email, password: authForm.password },
      });
      await SecureStore.setItemAsync('spendwise-token', result.token);
      setToken(result.token);
      setUser(result.user);
      setScreen('Overview');
    } catch (error) {
      Alert.alert('Sign in failed', error.message);
    }
  };

  const save = async (path, body, method = 'POST') => {
    try {
      await request(path, { token, method, body });
      setFormOpen(false);
      await load();
    } catch (error) {
      Alert.alert('Could not save', error.message);
    }
  };

  const remove = (path, id) => Alert.alert('Delete item?', 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => request(`${path}/${id}`, { token, method: 'DELETE' }).then(load).catch((error) => Alert.alert('Could not delete', error.message)) },
  ]);

  const logout = async () => {
    await SecureStore.deleteItemAsync('spendwise-token');
    setToken(null);
    setUser(null);
    setData([]);
    setScreen('Overview');
  };

  const changeScreen = (name) => {
    setScreen(name);
    setFormOpen(false);
  };

  const submitExpense = () => {
    const activeSubtypes = expenseForm.subtypes.filter((sub) => sub.type.trim() && Number(sub.amount) > 0);
    const amount = expenseForm.hasSubtypes
      ? activeSubtypes.reduce((sum, sub) => sum + Number(sub.amount), 0)
      : Number(expenseForm.amount);
    if (!expenseForm.item.trim() || amount <= 0) return Alert.alert('Add an item and a valid amount');
    if (expenseForm.hasSubtypes && !activeSubtypes.length) return Alert.alert('Add at least one subtype with an amount');
    save('/expenses', {
      item: expenseForm.item.trim(), description: expenseForm.item.trim(), category: 'Other',
      date: today(), amount, paymentMethod: expenseForm.paymentMethod,
      hasSubtypes: expenseForm.hasSubtypes, subtypes: expenseForm.hasSubtypes ? activeSubtypes : [],
    });
    setExpenseForm(initialExpense());
  };

  const submitMessage = () => {
    const destination = messageForm.channel === 'email' ? messageForm.email : messageForm.phone;
    if (!messageForm.contactName.trim() || !destination.trim() || !messageForm.message.trim()) return Alert.alert('Complete the contact and message fields');
    const scheduledAt = new Date(`${messageForm.date}T${messageForm.time}:00`);
    save('/messages', {
      ...messageForm,
      scheduledAt: scheduledAt.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
      recipientConsented: messageForm.recipientConsented,
    });
    setMessageForm(initialMessage());
  };

  const setSub = (index, key, value) => setExpenseForm((current) => ({
    ...current,
    subtypes: current.subtypes.map((sub, i) => i === index ? { ...sub, [key]: value } : sub),
  }));

  const pageTitle = screen === 'Overview' ? 'Your money, at a glance' : screen;
  const renderForm = () => {
    if (!formOpen) return null;
    if (screen === 'Expenses') return (
      <Card styles={styles}>
        <Text style={styles.cardTitle}>Add expense</Text>
        <Field label="Item" value={expenseForm.item} onChangeText={(item) => setExpenseForm({ ...expenseForm, item })} placeholder="e.g. Groceries" styles={styles} />
        <View style={styles.inlineRow}>
          <View style={styles.flex}><Field label="Amount" value={expenseForm.amount} onChangeText={(amount) => setExpenseForm({ ...expenseForm, amount })} keyboardType="decimal-pad" placeholder="₹ 0" styles={styles} /></View>
          <View style={styles.flex}><Text style={styles.label}>Payment method</Text><PaymentChips value={expenseForm.paymentMethod} onChange={(paymentMethod) => setExpenseForm({ ...expenseForm, paymentMethod })} styles={styles} compact /></View>
        </View>
        <View style={styles.inlineRow}>
          <Text style={styles.label}>Split into subtypes</Text>
          <Switch value={expenseForm.hasSubtypes} onValueChange={(hasSubtypes) => setExpenseForm({ ...expenseForm, hasSubtypes })} trackColor={{ true: BRAND }} />
        </View>
        {expenseForm.hasSubtypes && expenseForm.subtypes.map((sub, index) => (
          <View key={index} style={styles.subtypeBox}>
            <View style={styles.inlineRow}>
              <View style={styles.flex}><Field label="Subtype" value={sub.type} onChangeText={(value) => setSub(index, 'type', value)} placeholder="e.g. Vegetables" styles={styles} /></View>
              <Pressable onPress={() => setExpenseForm({ ...expenseForm, subtypes: expenseForm.subtypes.filter((_, i) => i !== index) })}><Text style={styles.removeText}>Remove</Text></Pressable>
            </View>
            <Field label="Subtype amount" value={sub.amount} onChangeText={(value) => setSub(index, 'amount', value)} keyboardType="decimal-pad" placeholder="₹ 0" styles={styles} />
            <PaymentChips value={sub.paymentMethod} onChange={(value) => setSub(index, 'paymentMethod', value)} styles={styles} compact />
          </View>
        ))}
        {expenseForm.hasSubtypes && <Action title="Add subtype" secondary onPress={() => setExpenseForm({ ...expenseForm, subtypes: [...expenseForm.subtypes, { type: '', amount: '', paymentMethod: 'Cash' }] })} styles={styles} />}
        <Action title="Save expense" onPress={submitExpense} styles={styles} />
      </Card>
    );
    if (screen === 'Income') return (
      <Card styles={styles}>
        <Text style={styles.cardTitle}>Add income</Text>
        <Field label="Source" value={incomeForm.source} onChangeText={(source) => setIncomeForm({ ...incomeForm, source })} placeholder="e.g. Salary" styles={styles} />
        <Field label="Amount" value={incomeForm.amount} onChangeText={(amount) => setIncomeForm({ ...incomeForm, amount })} keyboardType="decimal-pad" placeholder="₹ 0" styles={styles} />
        <Field label="Date (YYYY-MM-DD)" value={incomeForm.date} onChangeText={(date) => setIncomeForm({ ...incomeForm, date })} styles={styles} />
        <Action title="Save income" onPress={() => save('/income', { ...incomeForm, amount: Number(incomeForm.amount) })} styles={styles} />
      </Card>
    );
    if (screen === 'Budgets') return (
      <Card styles={styles}>
        <Text style={styles.cardTitle}>Set monthly budget</Text>
        <Field label="Month (1–12)" value={budgetForm.month} onChangeText={(month) => setBudgetForm({ ...budgetForm, month })} keyboardType="number-pad" styles={styles} />
        <Field label="Budget amount" value={budgetForm.limit} onChangeText={(limit) => setBudgetForm({ ...budgetForm, limit })} keyboardType="decimal-pad" placeholder="₹ 0" styles={styles} />
        <Action title="Save budget" onPress={() => save('/budgets', { month: Number(budgetForm.month), year: new Date().getFullYear(), limit: Number(budgetForm.limit) }, 'PUT')} styles={styles} />
      </Card>
    );
    if (screen === 'Reminders') return (
      <Card styles={styles}>
        <Text style={styles.cardTitle}>Add reminder</Text>
        <Field label="What should you remember?" value={reminderForm.title} onChangeText={(title) => setReminderForm({ ...reminderForm, title })} placeholder="e.g. Electricity bill" styles={styles} />
        <Field label="Due date (YYYY-MM-DD)" value={reminderForm.dueDate} onChangeText={(dueDate) => setReminderForm({ ...reminderForm, dueDate })} styles={styles} />
        <Field label="Amount (optional)" value={reminderForm.amount} onChangeText={(amount) => setReminderForm({ ...reminderForm, amount })} keyboardType="decimal-pad" placeholder="₹ 0" styles={styles} />
        <Action title="Save reminder" onPress={() => save('/reminders', { ...reminderForm, amount: reminderForm.amount ? Number(reminderForm.amount) : undefined })} styles={styles} />
      </Card>
    );
    if (screen === 'Scheduled messages') return (
      <Card styles={styles}>
        <Text style={styles.cardTitle}>Schedule a message</Text>
        <Field label="Contact name" value={messageForm.contactName} onChangeText={(contactName) => setMessageForm({ ...messageForm, contactName })} styles={styles} />
        <Text style={styles.label}>Send with</Text>
        <ChoiceChips choices={['email', 'sms', 'whatsapp']} value={messageForm.channel} onChange={(channel) => setMessageForm({ ...messageForm, channel })} styles={styles} />
        <Field label={messageForm.channel === 'email' ? 'Email address' : 'Phone number'} value={messageForm.channel === 'email' ? messageForm.email : messageForm.phone} onChangeText={(value) => setMessageForm({ ...messageForm, [messageForm.channel === 'email' ? 'email' : 'phone']: value })} keyboardType={messageForm.channel === 'email' ? 'email-address' : 'phone-pad'} styles={styles} />
        <Field label="Message" value={messageForm.message} onChangeText={(message) => setMessageForm({ ...messageForm, message })} multiline placeholder="Use {name} to personalize" styles={styles} />
        <Text style={styles.label}>Repeat</Text>
        <ChoiceChips choices={['once', 'daily', 'weekly', 'monthly']} value={messageForm.frequency} onChange={(frequency) => setMessageForm({ ...messageForm, frequency })} styles={styles} />
        <View style={styles.inlineRow}>
          <View style={styles.flex}><Field label="Date (YYYY-MM-DD)" value={messageForm.date} onChangeText={(date) => setMessageForm({ ...messageForm, date })} styles={styles} /></View>
          <View style={styles.flex}><Field label="Time (24h)" value={messageForm.time} onChangeText={(time) => setMessageForm({ ...messageForm, time })} styles={styles} /></View>
        </View>
        <Pressable style={styles.consentRow} onPress={() => setMessageForm({ ...messageForm, recipientConsented: !messageForm.recipientConsented })}>
          <View style={[styles.checkbox, messageForm.recipientConsented && styles.checkboxOn]}><Text style={styles.checkText}>{messageForm.recipientConsented ? '✓' : ''}</Text></View>
          <Text style={styles.muted}>I have permission to message this person</Text>
        </Pressable>
        {messageStatus && !messageStatus[messageForm.channel === 'email' ? 'emailConfigured' : messageForm.channel === 'sms' ? 'smsConfigured' : 'whatsappConfigured'] && <Text style={styles.warningText}>Delivery is not configured on the server yet.</Text>}
        <Action title="Schedule message" onPress={submitMessage} styles={styles} />
      </Card>
    );
    return null;
  };

  const renderBody = () => {
    if (screen === 'Overview') return (
      <>
        <View style={styles.statGrid}>
          <Stat label="Income this month" value={money(summary?.totalMonthIncome)} styles={styles} />
          <Stat label="Expenses this month" value={money(summary?.totalMonthExpense)} styles={styles} />
          <Stat label="Balance" value={money(summary?.remainingBalance)} styles={styles} accent />
          <Stat label="Spent today" value={money(summary?.todayExpense)} styles={styles} />
        </View>
        <SectionTitle title="Recent expenses" styles={styles} />
        {data.map((expense) => <ExpenseRow key={expense._id} item={expense} styles={styles} onDelete={() => remove('/expenses', expense._id)} />)}
      </>
    );
    if (screen === 'Expenses') return <>
      {data.map((expense) => <ExpenseRow key={expense._id} item={expense} styles={styles} onDelete={() => remove('/expenses', expense._id)} />)}
      {!data.length && <Empty text="No expenses recorded for this month." styles={styles} />}
    </>;
    if (screen === 'Income') return <>
      {data.map((entry) => <Card styles={styles} key={entry._id}>
        <View style={styles.itemRow}><View style={styles.flex}><Text style={styles.itemTitle}>{entry.source}</Text><Text style={styles.muted}>{new Date(entry.date).toLocaleDateString()}</Text></View><Text style={styles.amount}>{money(entry.amount)}</Text><Pressable onPress={() => remove('/income', entry._id)}><Text style={styles.removeText}>×</Text></Pressable></View>
      </Card>)}
      {!data.length && <Empty text="No income entries for this month." styles={styles} />}
    </>;
    if (screen === 'Budgets') return <>
      {data.map((budget) => <Card styles={styles} key={budget._id}>
        <Text style={styles.itemTitle}>{new Date(2000, budget.month - 1).toLocaleString('en', { month: 'long' })} budget</Text>
        <Text style={styles.muted}>Spent {money(budget.spent)} of {money(budget.limit)}</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, (budget.spent / budget.limit) * 100)}%` }]} /></View>
      </Card>)}
      {!data.length && <Empty text="No budgets set for this year." styles={styles} />}
    </>;
    if (screen === 'Reminders') return <>
      {data.map((reminder) => <Card styles={styles} key={reminder._id}>
        <View style={styles.itemRow}><Pressable style={styles.flex} onPress={() => request(`/reminders/${reminder._id}`, { token, method: 'PATCH', body: { completed: !reminder.completed } }).then(load).catch((error) => Alert.alert('Could not update', error.message))}>
          <Text style={[styles.itemTitle, reminder.completed && styles.strike]}>{reminder.title}</Text><Text style={styles.muted}>{new Date(reminder.dueDate).toLocaleDateString()}{reminder.amount != null ? ` · ${money(reminder.amount)}` : ''}</Text>
        </Pressable><Text style={styles.badge}>{reminder.completed ? 'Done' : 'Open'}</Text><Pressable onPress={() => remove('/reminders', reminder._id)}><Text style={styles.removeText}>×</Text></Pressable></View>
      </Card>)}
      {!data.length && <Empty text="No reminders yet." styles={styles} />}
    </>;
    if (screen === 'Scheduled messages') return <>
      {data.map((message) => <Card styles={styles} key={message._id}>
        <View style={styles.itemRow}><View style={styles.flex}><Text style={styles.itemTitle}>{message.contactName}</Text><Text style={styles.muted}>{message.email || message.phone} · {message.channel}</Text></View><Text style={styles.badge}>{message.active ? 'Active' : 'Paused'}</Text></View>
        <Text style={styles.messagePreview}>{message.message}</Text>
        {message.lastError ? <Text style={styles.warningText}>{message.lastError}</Text> : null}
        <Text style={styles.muted}>{message.frequency} · {new Date(message.nextSendAt).toLocaleString()}</Text>
        <View style={styles.itemRow}>
          <Action title={message.active ? 'Pause' : 'Resume'} secondary onPress={() => request(`/messages/${message._id}`, { token, method: 'PATCH', body: { active: !message.active } }).then(load).catch((error) => Alert.alert('Could not update', error.message))} styles={styles} />
          <Pressable onPress={() => remove('/messages', message._id)}><Text style={styles.removeText}>Delete</Text></Pressable>
        </View>
      </Card>)}
      {!data.length && <Empty text="No scheduled messages yet." styles={styles} />}
    </>;
    if (screen === 'Reports') return <>
      <Card styles={styles}><Text style={styles.cardTitle}>{new Date().getFullYear()} overview</Text><Text style={styles.muted}>Monthly totals from your account</Text></Card>
      {data.map((month) => <Card styles={styles} key={month.month}>
        <View style={styles.itemRow}><Text style={[styles.itemTitle, styles.flex]}>{new Date(2000, month.month - 1).toLocaleString('en', { month: 'long' })}</Text><Text style={styles.muted}>{money(month.income - month.expenses)}</Text></View>
        <Text style={styles.muted}>Income {money(month.income)} · Expenses {money(month.expenses)}</Text>
      </Card>)}
    </>;
    return <MoreMenu styles={styles} changeScreen={changeScreen} logout={logout} user={user} />;
  };

  if (booting) return <SafeAreaView style={[styles.safe, styles.center]}><ActivityIndicator color={BRAND} size="large" /></SafeAreaView>;
  if (!token) return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView style={styles.authWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}><Text style={styles.logoMark}>W</Text></View>
          <Text style={styles.heroTitle}>Pocketwise</Text>
          <Text style={styles.muted}>{authMode === 'login' ? 'Sign in to pick up where you left off.' : 'Create an account to get started.'}</Text>
          {authMode === 'register' && <Field label="Name" value={authForm.name} onChangeText={(name) => setAuthForm({ ...authForm, name })} styles={styles} />}
          <Field label="Email" value={authForm.email} onChangeText={(email) => setAuthForm({ ...authForm, email })} keyboardType="email-address" autoCapitalize="none" styles={styles} />
          <Field label="Password" value={authForm.password} onChangeText={(password) => setAuthForm({ ...authForm, password })} secureTextEntry styles={styles} />
          <Action title={authMode === 'login' ? 'Sign in' : 'Create account'} onPress={signIn} styles={styles} />
          <Pressable onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={styles.authSwitch}>
            <Text style={styles.linkText}>{authMode === 'login' ? 'New to SpendWise? Create an account' : 'Already have an account? Sign in'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.appHeader}>
        <View><Text style={styles.eyebrow}>SPENDWISE</Text><Text style={styles.headerTitle}>{pageTitle}</Text></View>
        <Pressable onPress={load} accessibilityLabel="Refresh"><Text style={styles.refresh}>↻</Text></Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {screen === 'Overview' && <Text style={styles.greeting}>Hello{user?.name ? `, ${user.name}` : ''} 👋</Text>}
        {screen !== 'More' && screen !== 'Overview' && <Action title={formOpen ? 'Close form' : `+ Add ${screen === 'Expenses' ? 'expense' : screen === 'Income' ? 'income' : screen === 'Budgets' ? 'budget' : screen === 'Reminders' ? 'reminder' : 'message'}`} secondary onPress={() => setFormOpen(!formOpen)} styles={styles} />}
        {renderForm()}
        {loading ? <ActivityIndicator color={BRAND} style={styles.loader} /> : renderBody()}
      </ScrollView>
      <View style={styles.tabBar}>
        {['Overview', 'Expenses', 'Income', 'Budgets', 'More'].map((name) => (
          <Pressable key={name} onPress={() => changeScreen(name)} style={styles.tab}>
            <Text style={[styles.tabText, screen === name || (name === 'More' && ['Reminders', 'Scheduled messages', 'Reports'].includes(screen)) ? styles.tabActive : null]}>{name === 'Overview' ? 'Home' : name === 'Budgets' ? 'Plans' : name}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Field({ label, styles, ...props }) {
  return <View style={styles.fieldWrap}>
    <Text style={styles.label}>{label}</Text>
    <TextInput placeholderTextColor="#8b96aa" {...props} style={[styles.input, props.multiline && styles.multiline]} />
  </View>;
}

function Card({ children, styles }) { return <View style={styles.card}>{children}</View>; }
function Action({ title, onPress, styles, secondary }) {
  return <Pressable onPress={onPress} style={[styles.action, secondary && styles.actionSecondary]}><Text style={[styles.actionText, secondary && styles.actionSecondaryText]}>{title}</Text></Pressable>;
}
function SectionTitle({ title, styles }) { return <Text style={styles.sectionTitle}>{title}</Text>; }
function Empty({ text, styles }) { return <View style={styles.empty}><Text style={styles.muted}>{text}</Text></View>; }
function Stat({ label, value, styles, accent }) {
  return <View style={[styles.stat, accent && styles.statAccent]}><Text style={[styles.statLabel, accent && styles.statLabelAccent]}>{label}</Text><Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text></View>;
}
function ExpenseRow({ item, styles, onDelete }) {
  return <Card styles={styles}><View style={styles.itemRow}>
    <View style={styles.expenseIcon}><Text style={styles.expenseIconText}>↗</Text></View>
    <View style={styles.flex}><Text style={styles.itemTitle}>{item.item || item.description}</Text><Text style={styles.muted}>{methodLabel(item.paymentMethod)} · {new Date(item.date).toLocaleDateString()}</Text></View>
    <Text style={styles.amount}>{money(item.amount)}</Text>
    {onDelete && <Pressable onPress={onDelete}><Text style={styles.removeText}>×</Text></Pressable>}
  </View>
    {item.hasSubtypes && item.subtypes?.map((sub, index) => <Text key={index} style={styles.subText}>{sub.type} · {methodLabel(sub.paymentMethod)} · {money(sub.amount)}</Text>)}
  </Card>;
}
function ChoiceChips({ choices, value, onChange, styles }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
    {choices.map((choice) => <Pressable key={choice} onPress={() => onChange(choice)} style={[styles.chip, value === choice && styles.chipActive]}><Text style={[styles.chipText, value === choice && styles.chipTextActive]}>{choice}</Text></Pressable>)}
  </ScrollView>;
}
function PaymentChips({ value, onChange, styles, compact }) {
  const methods = PAYMENT_METHODS;
  return <ChoiceChips choices={methods} value={value} onChange={onChange} styles={styles} compact={compact} />;
}
function MoreMenu({ styles, changeScreen, logout, user }) {
  return <>
    <Card styles={styles}><Text style={styles.itemTitle}>{user?.name || user?.email || 'Your account'}</Text><Text style={styles.muted}>More tools and settings</Text></Card>
    {['Reminders', 'Scheduled messages', 'Reports'].map((name) => <Pressable key={name} onPress={() => changeScreen(name)} style={styles.moreRow}><Text style={styles.itemTitle}>{name}</Text><Text style={styles.linkText}>Open ›</Text></Pressable>)}
    <Action title="Sign out" secondary onPress={logout} styles={styles} />
  </>;
}

const lightTheme = { background: '#f3f6fb', surface: '#ffffff', ink: '#1b2940', muted: '#748198', line: '#e2e8f2', soft: '#e9edff' };
const darkTheme = { background: '#0e1625', surface: '#172337', ink: '#edf2ff', muted: '#9ba9c1', line: '#293850', soft: '#252f4d' };
function makeStyles(theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background }, center: { justifyContent: 'center', alignItems: 'center' },
    authWrap: { flex: 1 }, authContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    logo: { width: 46, height: 46, borderRadius: 15, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, logoMark: { color: '#fff', fontWeight: '900', fontSize: 22 },
    heroTitle: { color: theme.ink, fontSize: 32, fontWeight: '800', marginBottom: 6 },
    authSwitch: { paddingVertical: 18, alignItems: 'center' }, linkText: { color: isDarkTheme(theme) ? '#aebcff' : '#3552dc', fontSize: 13, fontWeight: '700' },
    appHeader: { minHeight: 78, backgroundColor: '#13213a', paddingHorizontal: 20, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    eyebrow: { color: '#aab9d2', fontSize: 9, fontWeight: '800', letterSpacing: 2 }, headerTitle: { color: '#fff', fontSize: 19, fontWeight: '800', marginTop: 3 }, refresh: { color: '#dce5f5', fontSize: 27, padding: 4 },
    scroll: { flex: 1 }, content: { padding: 17, paddingBottom: 28 }, greeting: { color: theme.ink, fontSize: 20, fontWeight: '700', marginBottom: 16 },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }, stat: { width: '48%', minHeight: 94, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 17, padding: 14, justifyContent: 'space-between' }, statAccent: { backgroundColor: '#273b66', borderColor: '#354c7d' }, statLabel: { color: theme.muted, fontSize: 11 }, statLabelAccent: { color: '#b8c9ec' }, statValue: { color: theme.ink, fontSize: 17, fontWeight: '800' }, statValueAccent: { color: '#fff' },
    card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 16, padding: 15, marginBottom: 11 }, cardTitle: { color: theme.ink, fontSize: 16, fontWeight: '800', marginBottom: 12 }, sectionTitle: { color: theme.ink, fontSize: 17, fontWeight: '800', marginBottom: 12, marginTop: 5 },
    fieldWrap: { marginBottom: 12, flex: 1 }, label: { color: theme.muted, fontSize: 11, fontWeight: '700', marginBottom: 6 }, input: { minHeight: 45, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.line, borderRadius: 11, color: theme.ink, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 }, multiline: { minHeight: 90, textAlignVertical: 'top' },
    inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, flex: { flex: 1, minWidth: 0 }, subtypeBox: { backgroundColor: theme.background, borderRadius: 12, borderWidth: 1, borderColor: theme.line, padding: 10, marginBottom: 10 },
    action: { minHeight: 45, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, borderRadius: 12, backgroundColor: BRAND, marginTop: 8 }, actionText: { color: '#fff', fontSize: 13, fontWeight: '800' }, actionSecondary: { backgroundColor: theme.soft }, actionSecondaryText: { color: isDarkTheme(theme) ? '#dce3ff' : '#3552dc' },
    chips: { flexDirection: 'row', gap: 7, paddingBottom: 7, paddingRight: 12 }, chip: { paddingVertical: 8, paddingHorizontal: 11, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.line, borderRadius: 20 }, chipActive: { backgroundColor: '#e9edff', borderColor: '#cbd4ff' }, chipText: { color: theme.muted, fontSize: 11, fontWeight: '600' }, chipTextActive: { color: '#3552dc', fontWeight: '800' },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, expenseIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: theme.soft, justifyContent: 'center', alignItems: 'center' }, expenseIconText: { color: BRAND, fontWeight: '800' }, itemTitle: { color: theme.ink, fontSize: 13, fontWeight: '800' }, muted: { color: theme.muted, fontSize: 11, marginTop: 3 }, amount: { color: theme.ink, fontSize: 13, fontWeight: '800' }, removeText: { color: '#d55252', fontWeight: '700', fontSize: 14, padding: 5 }, subText: { color: theme.muted, fontSize: 11, paddingTop: 8, paddingLeft: 45 },
    empty: { minHeight: 90, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 15, padding: 20 }, loader: { marginTop: 30 },
    progressTrack: { height: 7, backgroundColor: theme.soft, borderRadius: 5, marginTop: 12, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 5, backgroundColor: BRAND }, badge: { color: BRAND, backgroundColor: theme.soft, overflow: 'hidden', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '800' }, strike: { textDecorationLine: 'line-through', color: theme.muted }, messagePreview: { color: theme.ink, backgroundColor: theme.background, padding: 10, marginVertical: 10, borderRadius: 10, fontSize: 12 }, warningText: { color: '#b16e1a', fontSize: 11, marginVertical: 7 }, consentRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 8 }, checkbox: { width: 21, height: 21, borderRadius: 6, borderWidth: 1, borderColor: theme.line }, checkboxOn: { backgroundColor: BRAND, borderColor: BRAND, justifyContent: 'center', alignItems: 'center' }, checkText: { color: '#fff', fontWeight: '900' },
    tabBar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: theme.surface, borderTopWidth: 1, borderColor: theme.line, paddingBottom: Platform.OS === 'ios' ? 14 : 5, paddingTop: 10 }, tab: { flex: 1, alignItems: 'center', paddingVertical: 4 }, tabText: { color: theme.muted, fontSize: 10, fontWeight: '700' }, tabActive: { color: BRAND }, moreRow: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 13, padding: 16, marginBottom: 9, flexDirection: 'row', justifyContent: 'space-between' },
  });
}
function isDarkTheme(theme) { return theme.background === darkTheme.background; }
