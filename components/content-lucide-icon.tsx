"use client";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { isContentIconKey } from "@/lib/content-icons";
import type { LucideProps } from "lucide-react";
import {
  Backpack, Badge, BadgeHelp, BriefcaseBusiness, Building2, Bus, Camera, Check, Clock, Compass, Contact, Dog, EyeOff,
  HandHelping, Heart, HeartHandshake, Home, ImageUp, Lock, Luggage, Map, MapPin, Medal, MessageCircle, Mic2, Package, PawPrint, Phone,
  Plane, QrCode, Radio, RefreshCw, Repeat2, Share2, Shield, ShieldCheck, ShoppingBag, Sparkles, SquarePen, Store, Tag,
  Shapes, Trees, Users, Zap, Layers, Palette,
  BrushCleaning, PackageOpen, Feather, Droplets, Droplet, Leaf, ScanBox, HandCoins, PackageCheck, Truck, LockKeyhole, CircleUserRound, UserRound, SlidersHorizontal, Menu, X, Plus, Minus, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, ChevronDown, Play, CirclePlay, Sparkle, Ruler, Recycle, Printer, CircleCheck, CircleHelp, MousePointerClick, Move, Weight, Hand, SwatchBook,
} from "lucide-react";

export const contentLucideIcons = {
  backpack: Backpack, badge: Badge, business: BriefcaseBusiness, "briefcase-business": BriefcaseBusiness,
  "badge-help": BadgeHelp, building: Building2, bus: Bus, camera: Camera, check: Check, clock: Clock, compass: Compass, contact: Contact, dog: Dog,
  "eye-off": EyeOff, "hand-helping": HandHelping, heart: Heart, "heart-handshake": HeartHandshake, home: Home, "image-pen": ImageUp, lock: Lock, luggage: Luggage, map: Map,
  "map-pin": MapPin, message: MessageCircle, "message-circle": MessageCircle, "mic-2": Mic2,
  medal: Medal, package: Package, paw: PawPrint, phone: Phone, plane: Plane, "qr-code": QrCode, radio: Radio, refresh: RefreshCw,
  "refresh-cw": RefreshCw, repeat: Repeat2, share: Share2, "share-2": Share2, shield: Shield,
  "shield-check": ShieldCheck, "shopping-bag": ShoppingBag, sparkles: Sparkles, "square-pen": SquarePen, store: Store, tag: Tag,
  layers: Layers, palette: Palette, shapes: Shapes, trees: Trees, users: Users, zap: Zap,
  "brush-cleaning": BrushCleaning, "package-open": PackageOpen, feather: Feather, droplets: Droplets, droplet: Droplet, leaf: Leaf, "scan-box": ScanBox, "hand-coins": HandCoins, "package-check": PackageCheck, truck: Truck, "lock-keyhole": LockKeyhole, "circle-user-round": CircleUserRound, "user-round": UserRound, "sliders-horizontal": SlidersHorizontal, menu: Menu, x: X, plus: Plus, minus: Minus, "arrow-right": ArrowRight, "arrow-up-right": ArrowUpRight, "chevron-left": ChevronLeft, "chevron-right": ChevronRight, "chevron-down": ChevronDown, play: Play, "circle-play": CirclePlay, sparkle: Sparkle, ruler: Ruler, recycle: Recycle, printer: Printer, "circle-check": CircleCheck, "circle-help": CircleHelp, "mouse-pointer-click": MousePointerClick, move: Move, weight: Weight, hand: Hand, "swatch-book": SwatchBook,
} as const;

export function ContentLucideIcon({ name, size = 24, ...props }: Omit<LucideProps, "name"> & { name?: string | null }) {
  const key = name ?? "radio";
  const Icon = Object.hasOwn(contentLucideIcons, key) ? contentLucideIcons[key as keyof typeof contentLucideIcons] : undefined;
  // Common interface icons remain synchronous. Other CMS choices load only the selected glyph.
  if (Icon) return <Icon aria-hidden="true" size={size} {...props} />;
  if (!isContentIconKey(key)) return <Radio aria-hidden="true" size={size} {...props} />;
  return <DynamicIcon key={key} name={key as IconName} aria-hidden="true" size={size} {...props} fallback={() => <span aria-hidden="true" style={{ display: "inline-block", width: size, height: size, flexShrink: 0 }} />} />;
}
