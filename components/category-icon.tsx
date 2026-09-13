import {
  Backpack, Badge, BadgeHelp, BriefcaseBusiness, Building2, Bus, Camera, Check, Compass, Contact, Dog, EyeOff,
  HandHelping, Heart, HeartHandshake, Home, ImageUp, Lock, Luggage, Map, MapPin, Medal, MessageCircle, Mic2, Package, PawPrint, Phone,
  Plane, QrCode, Radio, RefreshCw, Repeat2, Share2, Shield, ShieldCheck, ShoppingBag, Sparkles, SquarePen, Store, Tag,
  Trees, Users, Zap,
} from "lucide-react";

const categoryIcons = {
  backpack: Backpack, badge: Badge, business: BriefcaseBusiness, "briefcase-business": BriefcaseBusiness,
  "badge-help": BadgeHelp, building: Building2, bus: Bus, camera: Camera, check: Check, compass: Compass, contact: Contact, dog: Dog,
  "eye-off": EyeOff, "hand-helping": HandHelping, heart: Heart, "heart-handshake": HeartHandshake, home: Home, "image-pen": ImageUp, lock: Lock, luggage: Luggage, map: Map,
  "map-pin": MapPin, message: MessageCircle, "message-circle": MessageCircle, "mic-2": Mic2,
  medal: Medal, package: Package, paw: PawPrint, phone: Phone, plane: Plane, "qr-code": QrCode, radio: Radio, refresh: RefreshCw,
  "refresh-cw": RefreshCw, repeat: Repeat2, share: Share2, "share-2": Share2, shield: Shield,
  "shield-check": ShieldCheck, "shopping-bag": ShoppingBag, sparkles: Sparkles, "square-pen": SquarePen, store: Store, tag: Tag,
  trees: Trees, users: Users, zap: Zap,
} as const;

export function CategoryIcon({ name, size = 24 }: { name?: string | null; size?: number }) {
  const Icon = categoryIcons[(name ?? "radio") as keyof typeof categoryIcons] ?? Radio;
  return <Icon aria-hidden="true" size={size} />;
}
