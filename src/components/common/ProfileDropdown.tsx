import {
  addToast,
  Avatar,
  AvatarGroup,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { IoMdSettings } from "react-icons/io";
import { currentAdmin } from "../../lib/mockData";
import { useAuth } from "../../providers/AuthProvider";

export function ProfileDropdown() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const displayName = currentAdmin.name;
  const initials =
    currentAdmin.avatarInitials ||
    displayName.trim().charAt(0).toUpperCase() ||
    "U";
  const firstName =
    displayName
      .split(/[\s-]+/)[0]
      ?.replace(/^./, (c) => c.toUpperCase()) || "User";

  const handleLogout = () => {
    signOut();
    navigate("/sign-in", { replace: true });
    addToast({
      title: "You have logged out!",
      color: "warning",
    });
  };

  return (
    <Dropdown placement="bottom-end" showArrow offset={12}>
      <DropdownTrigger>
        <div className="flex cursor-pointer items-center gap-2 rounded bg-[#3a3a3a] p-1 pl-2 text-small text-white hover:bg-[#4a4a4a]">
          <span className="hidden sm:block">{displayName}</span>
          <div className="rounded bg-primary p-1 px-2.5 font-medium text-white">
            {initials.charAt(0)}
          </div>
        </div>
      </DropdownTrigger>

      <DropdownMenu
        aria-label="Profile Card"
        className="w-[280px] p-0"
        itemClasses={{
          base: "cursor-default data-[hover=true]:bg-transparent",
        }}
      >
        <DropdownItem key="profile-card" className="p-3" textValue="Profile">
          <p className="mb-2 text-xs text-gray-500">Currently In {firstName}</p>

          <div className="flex items-center gap-3">
            <Avatar
              size="sm"
              name={initials}
              classNames={{
                base: "shrink-0 border-none bg-blue-600 text-white",
              }}
            />

            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-gray-900">
                {displayName}
              </p>
              <p className="truncate text-xs text-gray-500">{currentAdmin.email}</p>
            </div>
          </div>

          <div className="my-3 border border-gray-100" />

          <p className="mb-2 text-xs text-gray-500">Teams</p>
          <AvatarGroup classNames={{ base: "gap-1" }}>
            <Avatar
              size="sm"
              name="A"
              classNames={{ base: "border-none bg-blue-600 text-white" }}
            />
            <Avatar
              size="sm"
              name="M"
              classNames={{ base: "border-none bg-indigo-600 text-white" }}
            />
            <Avatar
              size="sm"
              name="R"
              classNames={{ base: "border-none bg-rose-600 text-white" }}
            />
            <Avatar
              size="sm"
              name="+"
              classNames={{ base: "border-none bg-gray-200 text-xl" }}
            />
          </AvatarGroup>

          <div className="my-3 border border-gray-100" />

          <div className="flex items-center justify-between">
            <Button
              variant="light"
              disableAnimation
              startContent={<IoMdSettings />}
              className="px-0 text-sm hover:bg-transparent data-[hover=true]:bg-transparent"
              onPress={() => navigate("/settings/discounts")}
            >
              Account Settings
            </Button>

            <Button
              variant="ghost"
              color="primary"
              size="sm"
              radius="full"
              onPress={handleLogout}
              className="min-w-24 border px-6"
            >
              Log Out
            </Button>
          </div>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
