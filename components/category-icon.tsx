import {
  Backpack, Badge, BriefcaseBusiness, Building2, Bus, Camera, Check, Contact, Dog, EyeOff,
  Heart, Home, Lock, Luggage, Map, MapPin, MessageCircle, Mic2, Package, PawPrint, Phone,
  Plane, Radio, RefreshCw, Repeat2, Share2, Shield, ShieldCheck, ShoppingBag, Sparkles, Store,
  Trees, Users, Zap,
} from "lucide-react";

const categoryIcons = {
  backpack: Backpack, badge: Badge, business: BriefcaseBusiness, "briefcase-business": BriefcaseBusiness,
  building: Building2, bus: Bus, camera: Camera, check: Check, contact: Contact, dog: Dog,
  "eye-off": EyeOff, heart: Heart, home: Home, lock: Lock, luggage: Luggage, map: Map,
  "map-pin": MapPin, message: MessageCircle, "message-circle": MessageCircle, "mic-2": Mic2,
  package: Package, paw: PawPrint, phone: Phone, plane: Plane, radio: Radio, refresh: RefreshCw,
  "refresh-cw": RefreshCw, repeat: Repeat2, share: Share2, "share-2": Share2, shield: Shield,
  "shield-check": ShieldCheck, "shopping-bag": ShoppingBag, sparkles: Sparkles, store: Store,
  trees: Trees, users: Users, zap: Zap,
} as const;

export function CategoryIcon({ name, size = 24 }: { name?: string | null; size?: number }) {
  const Icon = categoryIcons[(name ?? "radio") as keyof typeof categoryIcons] ?? Radio;
  return <Icon aria-hidden="true" size={size} />;
}
