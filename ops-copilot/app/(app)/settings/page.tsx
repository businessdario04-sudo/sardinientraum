'use client';

import { useState } from 'react';
import { Save, CheckCircle2, Building2, Clock, AlertTriangle, Bot, MapPin, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Topbar } from '@/components/layout/topbar';
import { useApp } from '@/lib/store';

export default function SettingsPage() {
  const { state, updateSettings } = useApp();
  const [form, setForm] = useState({ ...state.settings });
  const [saved, setSaved] = useState(false);

  function handleChange(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Settings" subtitle="Organization configuration and AI preferences" />
      <main className="flex-1 p-6 max-w-3xl space-y-6">

        {/* Organization */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-500" />
              <CardTitle>Organization</CardTitle>
            </div>
            <CardDescription>Basic information about your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Company Name</Label>
                <Input value={form.company_name} onChange={(e) => handleChange('company_name', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block">Industry</Label>
                <Select value={form.industry} onValueChange={(v) => handleChange('industry', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Facility Management', 'Property Management', 'Logistics', 'Healthcare', 'Retail', 'Manufacturing', 'Other'].map((i) => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Locations & Teams */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-500" />
              <CardTitle>Locations & Teams</CardTitle>
            </div>
            <CardDescription>Define your operating locations and available teams</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Operating Locations</Label>
              <Textarea
                value={form.operating_locations}
                onChange={(e) => handleChange('operating_locations', e.target.value)}
                placeholder="HQ Tower (10 floors), Annex A, Parking Garage…"
                className="min-h-[80px]"
              />
              <p className="text-xs text-slate-400 mt-1">One per line or comma-separated. Used for AI location extraction.</p>
            </div>
            <div>
              <Label className="mb-1.5 block">Available Teams</Label>
              <Textarea
                value={form.available_teams}
                onChange={(e) => handleChange('available_teams', e.target.value)}
                placeholder="Maintenance, HVAC, Electrical, Cleaning, Security…"
                className="min-h-[60px]"
              />
              <p className="text-xs text-slate-400 mt-1">Comma-separated. Used for AI team assignment suggestions.</p>
            </div>
          </CardContent>
        </Card>

        {/* Working hours & Escalation */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <CardTitle>Hours & Escalation</CardTitle>
            </div>
            <CardDescription>Operational hours and escalation rules for AI context</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Working Hours</Label>
              <Input
                value={form.working_hours}
                onChange={(e) => handleChange('working_hours', e.target.value)}
                placeholder="Mon–Fri 07:00–19:00, On-call 24/7"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Escalation Rules</Label>
              <Textarea
                value={form.escalation_rules}
                onChange={(e) => handleChange('escalation_rules', e.target.value)}
                className="min-h-[80px]"
                placeholder="Critical → Ops Manager after 15 min. Ops Manager → Director after 30 min."
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Default Priority Rules</Label>
              <Textarea
                value={form.default_priority_rules}
                onChange={(e) => handleChange('default_priority_rules', e.target.value)}
                className="min-h-[80px]"
                placeholder="Safety = Critical. Guest-facing = High. Preventive = Medium/Low."
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-slate-500" />
              <CardTitle>AI Co-Pilot Settings</CardTitle>
            </div>
            <CardDescription>Control how the AI assistant behaves</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1.5 block">AI Response Tone</Label>
              <Select value={form.ai_tone} onValueChange={(v) => handleChange('ai_tone', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional (default)</SelectItem>
                  <SelectItem value="concise">Concise & direct</SelectItem>
                  <SelectItem value="detailed">Detailed & explanatory</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Custom AI Instructions</Label>
              <Textarea
                value={form.ai_instructions}
                onChange={(e) => handleChange('ai_instructions', e.target.value)}
                className="min-h-[100px]"
                placeholder="Be concise. Prioritize tenant safety. Always suggest contacting the on-call manager for critical issues…"
              />
              <p className="text-xs text-slate-400 mt-1">
                Additional context sent with every AI request. Use this to tune AI suggestions to your specific workflows.
              </p>
            </div>

            <Separator />

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">AI Safety Guarantees</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                    <li>• AI never auto-assigns or completes tasks</li>
                    <li>• Every AI suggestion requires your confirmation</li>
                    <li>• All AI actions are logged in the activity feed</li>
                    <li>• Fallback to manual flow if AI is unavailable</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={handleSave} className="gap-2">
            {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved!' : 'Save Settings'}
          </Button>
          {saved && <p className="text-sm text-green-600">Settings updated successfully.</p>}
        </div>
      </main>
    </div>
  );
}
