import { useState } from 'react';
import api, { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import AddressForm, { emptyAddress } from '../../components/AddressForm';
import { Field, PageHeader } from '../../components/ui';

export default function Account() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState({ name: user.name, phone: user.phone || '' });
  const [address, setAddress] = useState({ ...emptyAddress, ...(user.address || {}) });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const body = { ...profile, ...(address.line1 ? { address } : {}) };
      const { data } = await api.put('/auth/me', body);
      setUser(data.user);
      toast('Profile saved');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  const changePw = async (e) => {
    e.preventDefault();
    try {
      await api.put('/auth/password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      toast('Password changed');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Your account" subtitle={user.email} />
      <form onSubmit={saveProfile} className="panel space-y-4 p-5">
        <h2>Profile</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className="input" required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
        </div>
        {user.role === 'customer' && <><h3 className="pt-2">Default delivery address</h3><AddressForm value={address} onChange={setAddress} /></>}
        <button className="btn-primary">Save profile</button>
      </form>
      <form onSubmit={changePw} className="panel mt-6 space-y-4 p-5">
        <h2>Change password</h2>
        <Field label="Current password"><input className="input" type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" /></Field>
        <Field label="New password" hint="At least 8 characters, with a letter and a number."><input className="input" type="password" required minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" /></Field>
        <button className="btn-ghost">Change password</button>
      </form>
    </div>
  );
}
