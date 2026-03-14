import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield, Users, Wrench, Battery, Store, Mail, Pencil, Search, KeyRound
} from "lucide-react";

interface PortalUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  portal: string;
  role?: string;
  isAdmin?: number;
  portalLabel?: string;
  shopId?: number;
}

interface PortalUsersData {
  admins: PortalUser[];
  salesUsers: PortalUser[];
  technicians: PortalUser[];
  batteryUsers: PortalUser[];
  saasUsers: PortalUser[];
  saasShops: PortalUser[];
}

const PORTAL_META: Record<string, { labelAr: string; labelEn: string; icon: any; color: string }> = {
  admin:       { labelAr: "الإدارة",         labelEn: "Admin",         icon: Shield,  color: "text-red-500" },
  sales:       { labelAr: "المبيعات",        labelEn: "Sales",         icon: Store,   color: "text-blue-500" },
  technician:  { labelAr: "الفنيين",         labelEn: "Technicians",   icon: Wrench,  color: "text-orange-500" },
  battery:     { labelAr: "البطاريات",       labelEn: "Battery",       icon: Battery, color: "text-green-500" },
  saasShop:    { labelAr: "المتاجر (أصحاب)", labelEn: "Shops (Owners)",icon: Store,   color: "text-purple-500" },
  saas:        { labelAr: "المتاجر (موظفون)","labelEn": "Shop Staff",  icon: Users,   color: "text-pink-500" },
};

function maskEmail(email: string) {
  return email.replace(/(.{2}).+(@.+)/, "$1***$2");
}

export default function AdminUsers() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isRTL = language === 'ar';

  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<PortalUser | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const { data, isLoading } = useQuery<PortalUsersData>({
    queryKey: ['/api/admin/portal-users'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ portal, id, email, password }: { portal: string; id: string; email: string; password: string }) => {
      const res = await apiRequest('PATCH', `/api/admin/portal-users/${portal}/${id}`, { email, password });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === 'ar' ? 'تم التحديث بنجاح' : 'Updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portal-users'] });
      setEditingUser(null);
      setEditEmail("");
      setEditPassword("");
    },
    onError: (err: any) => {
      toast({ title: err.message, variant: 'destructive' });
    },
  });

  const openEdit = (user: PortalUser) => {
    setEditingUser(user);
    setEditEmail(user.email || "");
    setEditPassword("");
  };

  const handleSave = () => {
    if (!editingUser) return;
    if (editPassword && editPassword.length < 6) {
      toast({ title: language === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    updateMutation.mutate({ portal: editingUser.portal, id: editingUser.id, email: editEmail, password: editPassword });
  };

  // Flatten all users into one list for display
  const allGroups: { key: string; users: PortalUser[] }[] = data ? [
    { key: 'admin',      users: data.admins },
    { key: 'sales',      users: data.salesUsers },
    { key: 'technician', users: data.technicians },
    { key: 'battery',    users: data.batteryUsers },
    { key: 'saasShop',   users: data.saasShops },
    { key: 'saas',       users: data.saasUsers },
  ] : [];

  const filteredGroups = allGroups
    .map(g => ({
      ...g,
      users: g.users.filter(u =>
        !search ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(g => g.users.length > 0);

  const totalUsers = allGroups.reduce((s, g) => s + g.users.length, 0);
  const withEmail = allGroups.reduce((s, g) => s + g.users.filter(u => u.email).length, 0);

  return (
    <div className="p-6 space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            {language === 'ar' ? 'إدارة مستخدمي البوابات' : 'Portal User Management'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === 'ar'
              ? `${totalUsers} مستخدم إجمالاً · ${withEmail} لديهم بريد إلكتروني (OTP مفعّل)`
              : `${totalUsers} total users · ${withEmail} have email (OTP enabled)`}
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-user-search"
          />
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-4 text-sm text-blue-800 dark:text-blue-300">
        <Mail className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          {language === 'ar'
            ? 'المستخدمون الذين لديهم بريد إلكتروني سيُطلب منهم إدخال رمز OTP عند تسجيل الدخول. المستخدمون بدون بريد إلكتروني يسجلون دخولهم مباشرةً بكلمة المرور فقط.'
            : 'Users with an email will be required to enter an OTP code when logging in. Users without an email log in directly with their password only.'}
        </p>
      </div>

      {/* Groups */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-md" />)}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {language === 'ar' ? 'لا يوجد مستخدمون' : 'No users found'}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredGroups.map(({ key, users }) => {
            const meta = PORTAL_META[key];
            const Icon = meta.icon;
            return (
              <Card key={key}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${meta.color}`} />
                    {language === 'ar' ? meta.labelAr : meta.labelEn}
                    <Badge variant="secondary" className="ms-1">{users.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {users.map(user => (
                      <div
                        key={`${user.portal}-${user.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
                        data-testid={`row-user-${user.id}`}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium truncate">{user.displayName || user.username}</span>
                            <span className="text-xs text-muted-foreground">@{user.username}</span>
                            {user.portalLabel && (
                              <Badge variant="outline" className="text-xs">{user.portalLabel}</Badge>
                            )}
                            {user.role && (
                              <Badge variant="secondary" className="text-xs">{user.role}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {user.email ? (
                              <span className="text-foreground">{maskEmail(user.email)}</span>
                            ) : (
                              <span className="text-muted-foreground italic">
                                {language === 'ar' ? 'لا يوجد بريد إلكتروني' : 'No email — OTP disabled'}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(user)}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5 me-1.5" />
                          {language === 'ar' ? 'تعديل' : 'Edit'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) { setEditingUser(null); setEditEmail(""); setEditPassword(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تعديل المستخدم' : 'Edit User'}
            </DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-muted px-4 py-3 text-sm space-y-1">
                <p className="font-medium">{editingUser.displayName || editingUser.username}</p>
                <p className="text-muted-foreground">@{editingUser.username}</p>
                <p className="text-muted-foreground">
                  {language === 'ar' ? (PORTAL_META[editingUser.portal]?.labelAr) : (PORTAL_META[editingUser.portal]?.labelEn)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email" className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {language === 'ar' ? 'البريد الإلكتروني (لـ OTP)' : 'Email (for OTP)'}
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder={language === 'ar' ? 'اتركه فارغاً لتعطيل OTP' : 'Leave empty to disable OTP'}
                  data-testid="input-edit-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-password" className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  {language === 'ar' ? 'كلمة مرور جديدة (اختياري)' : 'New password (optional)'}
                </Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder={language === 'ar' ? 'اتركها فارغة للإبقاء' : 'Leave empty to keep current'}
                  data-testid="input-edit-password"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingUser(null)} data-testid="button-cancel-edit">
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-user">
              {updateMutation.isPending
                ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                : (language === 'ar' ? 'حفظ' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
