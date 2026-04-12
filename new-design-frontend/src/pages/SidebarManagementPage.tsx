import { useEffect, useMemo, useState } from 'react';
import { GripVertical, Plus, Save, ShieldAlert } from 'lucide-react';
import { fetchSidebarManagement, saveSidebarManagement } from '@/src/api/sidebar-management';
import { useAuth } from '@/src/features/auth/auth-context';
import { isSuperAdmin } from '@/src/lib/roles';
import { cn } from '@/src/lib/utils';
import type { SidebarManagementMenu, SidebarManagementResponse } from '@/src/types';

function createEmptyAccess(roles: SidebarManagementResponse['roles']) {
  return Object.fromEntries(
    roles.map((role, index) => [
      role.value,
      {
        order_index: (index + 1) * 10,
        is_visible: false,
      },
    ]),
  );
}

function normalizeMenus(data: SidebarManagementResponse) {
  return data.menus.map((menu, menuIndex) => ({
    ...menu,
    access: Object.fromEntries(
      data.roles.map((role) => [
        role.value,
        menu.access[role.value] || {
          order_index: (menuIndex + 1) * 10,
          is_visible: false,
        },
      ]),
    ),
  }));
}

function reorderRoleItems(menus: SidebarManagementMenu[], roleValue: string, draggedKey: string, targetKey: string) {
  const ordered = [...menus].sort((a, b) => {
    const aOrder = a.access[roleValue]?.order_index ?? 9999;
    const bOrder = b.access[roleValue]?.order_index ?? 9999;
    return aOrder - bOrder || a.label.localeCompare(b.label);
  });

  const draggedIndex = ordered.findIndex((item) => item.key === draggedKey);
  const targetIndex = ordered.findIndex((item) => item.key === targetKey);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return menus;
  }

  const [dragged] = ordered.splice(draggedIndex, 1);
  ordered.splice(targetIndex, 0, dragged);

  const nextOrder = new Map<string, number>();
  ordered.forEach((item, index) => {
    nextOrder.set(item.key, (index + 1) * 10);
  });

  return menus.map((menu) => ({
    ...menu,
    access: {
      ...menu.access,
      [roleValue]: {
        ...(menu.access[roleValue] || { is_visible: false }),
        order_index: nextOrder.get(menu.key) || menu.access[roleValue]?.order_index || 100,
      },
    },
  }));
}

export default function SidebarManagementPage() {
  const { session, refreshSession } = useAuth();
  const [data, setData] = useState<SidebarManagementResponse | null>(null);
  const [menus, setMenus] = useState<SidebarManagementMenu[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedMenuKey, setSelectedMenuKey] = useState('');
  const [draggedKey, setDraggedKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeRole = session?.user?.active_role || '';

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetchSidebarManagement();
        if (!active) {
          return;
        }
        const nextMenus = normalizeMenus(response);
        setData(response);
        setMenus(nextMenus);
        setSelectedRole(response.roles[0]?.value || '');
        setSelectedMenuKey(nextMenus[0]?.key || '');
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Sidebar management yuklanmadi.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const selectedMenu = useMemo(
    () => menus.find((menu) => menu.key === selectedMenuKey) || null,
    [menus, selectedMenuKey],
  );

  const orderedMenus = useMemo(() => {
    if (!selectedRole) {
      return menus;
    }
    return [...menus].sort((a, b) => {
      const aOrder = a.access[selectedRole]?.order_index ?? 9999;
      const bOrder = b.access[selectedRole]?.order_index ?? 9999;
      return aOrder - bOrder || a.label.localeCompare(b.label);
    });
  }, [menus, selectedRole]);

  function updateMenu(menuKey: string, updater: (menu: SidebarManagementMenu) => SidebarManagementMenu) {
    setMenus((current) => current.map((menu) => (menu.key === menuKey ? updater(menu) : menu)));
  }

  function addMenu() {
    if (!data) {
      return;
    }

    const newKey = `menu-${Date.now()}`;
    const newMenu: SidebarManagementMenu = {
      key: newKey,
      label: 'Yangi menu',
      section: data.sections[0]?.value || 'MAIN',
      icon_lucide: 'layout-dashboard',
      spa_path: '/',
      url_name: '',
      external_url: '',
      is_enabled: true,
      description: '',
      access: createEmptyAccess(data.roles),
    };

    setMenus((current) => [...current, newMenu]);
    setSelectedMenuKey(newKey);
    setSuccess(null);
    setError(null);
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await saveSidebarManagement(menus);
      const nextMenus = normalizeMenus(response.data);
      setData(response.data);
      setMenus(nextMenus);
      if (selectedMenuKey && !nextMenus.some((menu) => menu.key === selectedMenuKey)) {
        setSelectedMenuKey(nextMenus[0]?.key || '');
      }
      setSuccess('Sidebar konfiguratsiyasi saqlandi.');
      await refreshSession({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saqlash muvaffaqiyatsiz tugadi.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!session?.authenticated) {
    return null;
  }

  if (!isSuperAdmin(activeRole)) {
    return (
      <div className="rounded-3xl border border-border bg-white p-8 shadow-premium">
        <div className="flex items-center gap-3 text-danger">
          <ShieldAlert size={20} />
          <p className="text-lg font-black">Ruxsat yo&apos;q</p>
        </div>
        <p className="mt-3 text-sm font-medium text-text-secondary">Sidebar management sahifasi faqat `SUPER_ADMIN` roli uchun ochiladi.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border bg-white p-8 shadow-premium">
        <p className="label-micro">Sidebar management</p>
        <h2 className="mt-3 text-2xl font-black tracking-tight">Yuklanmoqda</h2>
        <p className="mt-2 text-sm font-medium text-text-secondary">Menu konfiguratsiyasi va role matrix olinmoqda.</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-3xl border border-danger/20 bg-white p-8 shadow-premium">
        <p className="label-micro text-danger">Xatolik</p>
        <h2 className="mt-3 text-2xl font-black tracking-tight">Sidebar management ochilmadi</h2>
        <p className="mt-2 text-sm font-medium text-text-secondary">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-white p-8 shadow-premium">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="label-micro">Sidebar management</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">Role permission matrix va dynamic ordering</h2>
            <p className="mt-3 max-w-4xl text-sm font-medium text-text-secondary">
              Bu sahifada sidebar menyularini frontend ichida boshqarasiz: yangi menu qo&apos;shish, role bo&apos;yicha ko&apos;rinishini
              belgilash, drag-and-drop orqali tartiblash va target yo&apos;llarni yangilash mumkin.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={addMenu}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-5 py-3 text-sm font-bold text-text-primary shadow-premium"
            >
              <Plus size={16} />
              Yangi menu
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 disabled:opacity-70"
            >
              <Save size={16} />
              {isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
        {error ? <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">{error}</p> : null}
        {success ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</p> : null}
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-white p-6 shadow-premium">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="label-micro">Drag and drop order</p>
                <h3 className="mt-2 text-xl font-black tracking-tight">Role bo&apos;yicha sidebar tartibi</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {data?.roles.map((role) => (
                  <button
                    type="button"
                    key={role.value}
                    onClick={() => setSelectedRole(role.value)}
                    className={cn(
                      'rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all',
                      selectedRole === role.value ? 'bg-slate-950 text-white' : 'bg-slate-100 text-text-secondary hover:bg-slate-200',
                    )}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {orderedMenus.map((menu) => {
                const access = menu.access[selectedRole] || { order_index: 100, is_visible: false };
                return (
                  <div
                    key={`${selectedRole}:${menu.key}`}
                    draggable
                    onDragStart={() => setDraggedKey(menu.key)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggedKey) {
                        setMenus((current) => reorderRoleItems(current, selectedRole, draggedKey, menu.key));
                      }
                      setDraggedKey('');
                    }}
                    className={cn(
                      'flex items-center gap-4 rounded-3xl border px-4 py-4 transition-all',
                      selectedMenuKey === menu.key ? 'border-primary/30 bg-primary/5' : 'border-border bg-white',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedMenuKey(menu.key)}
                      className="flex flex-1 items-center gap-4 text-left"
                    >
                      <span className="rounded-2xl bg-slate-100 p-2 text-text-muted">
                        <GripVertical size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-text-primary">{menu.label}</p>
                        <p className="mt-1 truncate text-xs font-bold text-text-muted">
                          {menu.key} • {access.order_index}
                        </p>
                      </div>
                    </button>
                    <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-secondary">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        checked={access.is_visible}
                        onChange={(event) => {
                          updateMenu(menu.key, (current) => ({
                            ...current,
                            access: {
                              ...current.access,
                              [selectedRole]: {
                                ...(current.access[selectedRole] || { order_index: 100 }),
                                is_visible: event.target.checked,
                              },
                            },
                          }));
                        }}
                      />
                      Visible
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-white p-6 shadow-premium">
            <p className="label-micro">Role permission matrix</p>
            <h3 className="mt-2 text-xl font-black tracking-tight">Menu visibility matritsasi</h3>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-widest text-text-muted">Menu</th>
                    {data?.roles.map((role) => (
                      <th key={role.value} className="px-3 py-2 text-center text-xs font-black uppercase tracking-widest text-text-muted">
                        {role.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {menus.map((menu) => (
                    <tr key={`matrix:${menu.key}`} className="rounded-2xl bg-slate-50/60">
                      <td className="rounded-l-2xl px-4 py-3 font-bold text-text-primary">{menu.label}</td>
                      {data?.roles.map((role) => (
                        <td key={`${menu.key}:${role.value}`} className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            checked={menu.access[role.value]?.is_visible || false}
                            onChange={(event) => {
                              updateMenu(menu.key, (current) => ({
                                ...current,
                                access: {
                                  ...current.access,
                                  [role.value]: {
                                    ...(current.access[role.value] || { order_index: 100 }),
                                    is_visible: event.target.checked,
                                  },
                                },
                              }));
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-white p-6 shadow-premium">
          <p className="label-micro">Menu editor</p>
          <h3 className="mt-2 text-xl font-black tracking-tight">Tanlangan menu sozlamalari</h3>

          {selectedMenu ? (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-text-muted">Key</span>
                  <input
                    value={selectedMenu.key}
                    onChange={(event) => {
                      const nextKey = event.target.value;
                      updateMenu(selectedMenu.key, (current) => ({ ...current, key: nextKey }));
                      setSelectedMenuKey(nextKey);
                    }}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary/30"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-text-muted">Label</span>
                  <input
                    value={selectedMenu.label}
                    onChange={(event) => updateMenu(selectedMenu.key, (current) => ({ ...current, label: event.target.value }))}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary/30"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-text-muted">Section</span>
                  <select
                    value={selectedMenu.section}
                    onChange={(event) => updateMenu(selectedMenu.key, (current) => ({ ...current, section: event.target.value }))}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary/30"
                  >
                    {data?.sections.map((section) => (
                      <option key={section.value} value={section.value}>
                        {section.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-text-muted">Icon</span>
                  <input
                    value={selectedMenu.icon_lucide}
                    onChange={(event) => updateMenu(selectedMenu.key, (current) => ({ ...current, icon_lucide: event.target.value }))}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary/30"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-text-muted">Tavsif</span>
                <textarea
                  value={selectedMenu.description}
                  onChange={(event) => updateMenu(selectedMenu.key, (current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary/30"
                />
              </label>

              <div className="space-y-4 rounded-3xl border border-border bg-slate-50/60 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-text-muted">Navigation target</p>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-text-muted">SPA path</span>
                  <input
                    value={selectedMenu.spa_path}
                    onChange={(event) => updateMenu(selectedMenu.key, (current) => ({ ...current, spa_path: event.target.value }))}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary/30"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-text-muted">URL name</span>
                  <input
                    value={selectedMenu.url_name}
                    onChange={(event) => updateMenu(selectedMenu.key, (current) => ({ ...current, url_name: event.target.value }))}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary/30"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-text-muted">External URL</span>
                  <input
                    value={selectedMenu.external_url}
                    onChange={(event) => updateMenu(selectedMenu.key, (current) => ({ ...current, external_url: event.target.value }))}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary/30"
                  />
                </label>
                <p className="text-xs font-bold text-text-muted">`spa_path`, `url_name` yoki `external_url` dan faqat bittasi to&apos;ldiriladi.</p>
              </div>

              <label className="inline-flex items-center gap-3 text-sm font-bold text-text-primary">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  checked={selectedMenu.is_enabled}
                  onChange={(event) => updateMenu(selectedMenu.key, (current) => ({ ...current, is_enabled: event.target.checked }))}
                />
                Menu enabled
              </label>
            </div>
          ) : (
            <p className="mt-6 text-sm font-medium text-text-secondary">Chap tarafdan biror menu tanlang yoki yangi menu qo&apos;shing.</p>
          )}
        </div>
      </section>
    </div>
  );
}
