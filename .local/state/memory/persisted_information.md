# Admin Navigation Fix - NEAR COMPLETION

## Completed Files
- AdminInventory.tsx - DONE
- AdminCustomers.tsx - DONE  
- AdminMarketPrices.tsx - DONE
- AdminExternalPrices.tsx - DONE

## Remaining Files (3)
Need to update with AdminNav:

### 1. AdminSettings.tsx
- Add admin auth query at top of component (after const declarations)
- Add loading state check before return
- Replace header section (lines ~262-271) with `<AdminNav currentAdmin={currentAdmin} />`

### 2. AdminProducts.tsx
- Add admin auth query at top of component
- Add useLocation import
- Add auth redirect useEffect
- Add loading state check
- Add AdminNav at top of return (around line 165-174)

### 3. AdminPrograms.tsx
- Add admin auth query at top of component  
- Add useLocation import
- Add auth redirect useEffect
- Add loading state check
- Replace back button section (lines ~224-230) with `<AdminNav currentAdmin={currentAdmin} />`

## Key Pattern for remaining files
Each file needs:
```tsx
// Add after component function declaration:
const [, setLocation] = useLocation(); // if not already present

const { data: currentAdmin, isLoading: authLoading, isError: authError } = useQuery<AdminUser>({
  queryKey: ['/api/admin/auth/me'],
  retry: false,
});

useEffect(() => {
  if (!authLoading && (authError || !currentAdmin)) {
    localStorage.removeItem("adminAuth");
    setLocation("/admin/login");
  }
}, [authLoading, authError, currentAdmin, setLocation]);

// Modify loading check:
if (authLoading || isLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );
}

if (!currentAdmin) {
  return null;
}

// In return, add at top of main container:
<AdminNav currentAdmin={currentAdmin} />
```

## Files to Check After Completion
Run the app and verify all admin pages have consistent navigation with:
- Dashboard link
- Products link
- Inventory link  
- Customers link
- Market Prices link
- Programs link
- Settings link
- Logout button
