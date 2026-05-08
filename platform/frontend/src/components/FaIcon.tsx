'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowLeft,
  faBell,
  faBriefcase,
  faBuilding,
  faChartBar,
  faChartLine,
  faChartPie,
  faCheckCircle,
  faCheckSquare,
  faChevronDown,
  faChevronUp,
  faCircle,
  faClipboardList,
  faClock,
  faCode,
  faCopy,
  faCrosshairs,
  faDatabase,
  faDownload,
  faEdit,
  faEnvelope,
  faEnvelopeOpen,
  faExclamationTriangle,
  faEye,
  faEyeSlash,
  faFileAlt,
  faFilter,
  faFlag,
  faHardDrive,
  faHashtag,
  faInfoCircle,
  faKey,
  faLink,
  faList,
  faListCheck,
  faLock,
  faMicrochip,
  faPaperPlane,
  faPen,
  faPlay,
  faPlug,
  faPlus,
  faPlusCircle,
  faPowerOff,
  faQuestionCircle,
  faRadio,
  faRedo,
  faRightToBracket,
  faRightFromBracket,
  faRotateRight,
  faSave,
  faSearch,
  faServer,
  faShareAlt,
  faShieldAlt,
  faShieldHalved,
  faSitemap,
  faSliders,
  faStar,
  faStarHalfAlt,
  faTag,
  faTags,
  faTasks,
  faTimesCircle,
  faToggleOff,
  faToggleOn,
  faTrash,
  faUnlock,
  faUpload,
  faUser,
  faUserCheck,
  faUserCircle,
  faUserCog,
  faUserPlus,
  faUsers,
  faWifi,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import type { CSSProperties } from 'react';

export type LucideIcon = (props: FaIconProps) => JSX.Element;

type FaIconProps = {
  size?: number | string;
  className?: string;
  color?: string;
  fill?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  title?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
};

function makeIcon(icon: IconDefinition): LucideIcon {
  return function Icon({ size = 14, className, color, fill, style, title, ...rest }: FaIconProps) {
    const px = typeof size === 'number' ? `${size}px` : size;
    return (
      <FontAwesomeIcon
        icon={icon}
        className={className}
        title={title}
        style={{ width: px, height: px, color: color ?? fill, ...style }}
        {...rest}
      />
    );
  };
}

export const Activity = makeIcon(faChartLine);
export const AlertTriangle = makeIcon(faExclamationTriangle);
export const ArrowLeft = makeIcon(faArrowLeft);
export const BarChart3 = makeIcon(faChartBar);
export const Bell = makeIcon(faBell);
export const Briefcase = makeIcon(faBriefcase);
export const Building2 = makeIcon(faBuilding);
export const CheckCircle = makeIcon(faCheckCircle);
export const CheckCircle2 = makeIcon(faCheckCircle);
export const CheckSquare = makeIcon(faCheckSquare);
export const ChevronDown = makeIcon(faChevronDown);
export const ChevronUp = makeIcon(faChevronUp);
export const Circle = makeIcon(faCircle);
export const ClipboardList = makeIcon(faClipboardList);
export const Clock = makeIcon(faClock);
export const Clock3 = makeIcon(faClock);
export const Copy = makeIcon(faCopy);
export const Crosshair = makeIcon(faCrosshairs);
export const Database = makeIcon(faDatabase);
export const Download = makeIcon(faDownload);
export const Edit2 = makeIcon(faEdit);
export const Edit3 = makeIcon(faPen);
export const Eye = makeIcon(faEye);
export const EyeOff = makeIcon(faEyeSlash);
export const FileCode2 = makeIcon(faCode);
export const FileText = makeIcon(faFileAlt);
export const Filter = makeIcon(faFilter);
export const Flag = makeIcon(faFlag);
export const GitMerge = makeIcon(faSitemap);
export const HardDrive = makeIcon(faHardDrive);
export const Hash = makeIcon(faHashtag);
export const Info = makeIcon(faInfoCircle);
export const KeyRound = makeIcon(faKey);
export const LayoutDashboard = makeIcon(faChartBar);
export const Link = makeIcon(faLink);
export const Link2 = makeIcon(faLink);
export const List = makeIcon(faList);
export const ListChecks = makeIcon(faListCheck);
export const Lock = makeIcon(faLock);
export const LogIn = makeIcon(faRightToBracket);
export const LogOut = makeIcon(faRightFromBracket);
export const Mail = makeIcon(faEnvelope);
export const MailOpen = makeIcon(faEnvelopeOpen);
export const MessageSquare = makeIcon(faEnvelope);
export const PieChart = makeIcon(faChartPie);
export const Play = makeIcon(faPlay);
export const Plus = makeIcon(faPlus);
export const PlusCircle = makeIcon(faPlusCircle);
export const Power = makeIcon(faPowerOff);
export const PowerOff = makeIcon(faPowerOff);
export const Radio = makeIcon(faRadio);
export const RefreshCw = makeIcon(faRotateRight);
export const RotateCcw = makeIcon(faRedo);
export const Save = makeIcon(faSave);
export const Search = makeIcon(faSearch);
export const Send = makeIcon(faPaperPlane);
export const Server = makeIcon(faServer);
export const Settings = makeIcon(faUserCog);
export const Share2 = makeIcon(faShareAlt);
export const Shield = makeIcon(faShieldAlt);
export const ShieldAlert = makeIcon(faShieldHalved);
export const ShieldCheck = makeIcon(faShieldHalved);
export const SlidersHorizontal = makeIcon(faSliders);
export const Star = makeIcon(faStar);
export const StarOff = makeIcon(faStarHalfAlt);
export const Tag = makeIcon(faTag);
export const Tags = makeIcon(faTags);
export const ToggleLeft = makeIcon(faToggleOff);
export const ToggleRight = makeIcon(faToggleOn);
export const Trash2 = makeIcon(faTrash);
export const TrendingUp = makeIcon(faChartLine);
export const Unlink = makeIcon(faPlug);
export const Unlock = makeIcon(faUnlock);
export const Upload = makeIcon(faUpload);
export const User = makeIcon(faUser);
export const UserCheck = makeIcon(faUserCheck);
export const UserCircle2 = makeIcon(faUserCircle);
export const UserCog = makeIcon(faUserCog);
export const UserPlus = makeIcon(faUserPlus);
export const Users = makeIcon(faUsers);
export const Wifi = makeIcon(faWifi);
export const WifiOff = makeIcon(faTimesCircle);
export const XCircle = makeIcon(faTimesCircle);

export const QuestionCircle = makeIcon(faQuestionCircle);
export const Times = makeIcon(faXmark);
export const Tasks = makeIcon(faTasks);
export const Cpu = makeIcon(faMicrochip);
