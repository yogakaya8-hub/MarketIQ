import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import {
  LayoutDashboard, Package, ShoppingBag, ClipboardList, HandCoins, TrendingDown, BadgePercent, MousePointerClick,
  Store, Bell, Flag, Users, Activity, Settings, Inbox,
} from 'lucide-react';
import ShopLayout from './components/ShopLayout';
import ConsoleLayout from './components/ConsoleLayout';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/public/Home';
import Products from './pages/public/Products';
import ProductDetail from './pages/public/ProductDetail';
import RescueDeals from './pages/public/RescueDeals';
import Stores from './pages/public/Stores';
import StorePage from './pages/public/StorePage';
import Login from './pages/public/Login';
import Register from './pages/public/Register';
import NotFound from './pages/public/NotFound';

import Cart from './pages/customer/Cart';
import Checkout from './pages/customer/Checkout';
import MyOrders from './pages/customer/MyOrders';
import MyRequirements from './pages/customer/MyRequirements';
import PostRequirement from './pages/customer/PostRequirement';
import RequirementDetail from './pages/customer/RequirementDetail';
import Account from './pages/customer/Account';

import OrderDetail from './pages/shared/OrderDetail';
import Notifications from './pages/shared/Notifications';
import Reports from './pages/shared/Reports';
import InventoryIntelligence from './pages/shared/InventoryIntelligence';
import DropoffInsights from './pages/shared/DropoffInsights';

import VendorDashboard from './pages/vendor/VendorDashboard';
import VendorProducts from './pages/vendor/VendorProducts';
import ProductForm from './pages/vendor/ProductForm';
import VendorOrders from './pages/vendor/VendorOrders';
import RequirementBoard from './pages/vendor/RequirementBoard';
import VendorRequirement from './pages/vendor/VendorRequirement';
import VendorOffers from './pages/vendor/VendorOffers';
import VendorDeals from './pages/vendor/VendorDeals';
import StoreProfile from './pages/vendor/StoreProfile';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminVendors from './pages/admin/AdminVendors';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOrders from './pages/admin/AdminOrders';
import AdminMarketplace from './pages/admin/AdminMarketplace';
import AdminReports from './pages/admin/AdminReports';
import AdminActivity from './pages/admin/AdminActivity';
import AdminSettings from './pages/admin/AdminSettings';

const VENDOR_NAV = [
  { title: 'Store', items: [
    { to: '/vendor', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/vendor/products', label: 'Products', icon: Package },
    { to: '/vendor/orders', label: 'Orders', icon: ShoppingBag },
  ] },
  { title: 'Reverse marketplace', items: [
    { to: '/vendor/requirements', label: 'Requirement board', icon: ClipboardList },
    { to: '/vendor/offers', label: 'My offers', icon: HandCoins },
  ] },
  { title: 'Intelligence', items: [
    { to: '/vendor/inventory', label: 'Dead stock alerts', icon: TrendingDown },
    { to: '/vendor/deals', label: 'Rescue deals', icon: BadgePercent },
    { to: '/vendor/insights', label: 'Purchase drop-off', icon: MousePointerClick },
  ] },
  { title: 'Account', items: [
    { to: '/vendor/profile', label: 'Store profile', icon: Store },
    { to: '/vendor/notifications', label: 'Notifications', icon: Bell },
    { to: '/vendor/reports', label: 'Report an issue', icon: Flag },
  ] },
];

const ADMIN_NAV = [
  { title: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  { title: 'People', items: [
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/vendors', label: 'Vendors', icon: Store },
  ] },
  { title: 'Marketplace', items: [
    { to: '/admin/products', label: 'Products', icon: Package },
    { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
    { to: '/admin/marketplace', label: 'Requirements & offers', icon: ClipboardList },
  ] },
  { title: 'Intelligence', items: [
    { to: '/admin/inventory', label: 'Inventory risk', icon: TrendingDown },
    { to: '/admin/insights', label: 'Purchase drop-off', icon: MousePointerClick },
  ] },
  { title: 'Operations', items: [
    { to: '/admin/reports', label: 'Reported issues', icon: Inbox },
    { to: '/admin/activity', label: 'System activity', icon: Activity },
    { to: '/admin/settings', label: 'Thresholds', icon: Settings },
    { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  ] },
];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<ShopLayout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:id" element={<ProductDetail />} />
          <Route path="deals" element={<RescueDeals />} />
          <Route path="stores" element={<Stores />} />
          <Route path="stores/:id" element={<StorePage />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />

          <Route element={<ProtectedRoute roles={['customer']} />}>
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="orders" element={<MyOrders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="requirements" element={<MyRequirements />} />
            <Route path="requirements/new" element={<PostRequirement />} />
            <Route path="requirements/:id" element={<RequirementDetail />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="notifications" element={<Notifications />} />
            <Route path="reports" element={<Reports />} />
            <Route path="account" element={<Account />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route element={<ProtectedRoute roles={['vendor']} />}>
          <Route path="vendor" element={<ConsoleLayout sections={VENDOR_NAV} title="Vendor console" base="/vendor" />}>
            <Route index element={<VendorDashboard />} />
            <Route path="products" element={<VendorProducts />} />
            <Route path="products/new" element={<ProductForm />} />
            <Route path="products/:id/edit" element={<ProductForm />} />
            <Route path="orders" element={<VendorOrders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="requirements" element={<RequirementBoard />} />
            <Route path="requirements/:id" element={<VendorRequirement />} />
            <Route path="offers" element={<VendorOffers />} />
            <Route path="inventory" element={<InventoryIntelligence />} />
            <Route path="deals" element={<VendorDeals />} />
            <Route path="insights" element={<DropoffInsights />} />
            <Route path="profile" element={<StoreProfile />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="admin" element={<ConsoleLayout sections={ADMIN_NAV} title="Admin console" base="/admin" />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="vendors" element={<AdminVendors />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="marketplace" element={<AdminMarketplace />} />
            <Route path="inventory" element={<InventoryIntelligence />} />
            <Route path="insights" element={<DropoffInsights />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="activity" element={<AdminActivity />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
