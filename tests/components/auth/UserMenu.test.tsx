// SPDX-License-Identifier: Apache-2.0
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import UserMenu from "@/components/auth/UserMenu";

// Mock next-auth signOut function
const mockSignOut = vi.fn();
vi.mock("next-auth/react", () => ({
  signOut: (options?: { callbackUrl?: string }) => mockSignOut(options),
}));

describe("UserMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("Avatar Display", () => {
    it("should display user image when provided", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: "https://example.com/avatar.jpg",
      };

      render(<UserMenu user={user} />);

      const img = screen.getByAltText("");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
    });

    it("should display initials when image is not provided", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      // Should display first 2 characters of name
      expect(screen.getByText("JO")).toBeInTheDocument();
    });

    it("should use email for initials when name is not provided", () => {
      const user = {
        name: null,
        email: "john@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      // Should display first 2 characters of email
      expect(screen.getByText("JO")).toBeInTheDocument();
    });

    it("should display question mark when neither name nor email is provided", () => {
      const user = {
        name: null,
        email: null,
        image: null,
      };

      render(<UserMenu user={user} />);

      expect(screen.getByText("?")).toBeInTheDocument();
    });

    it("should uppercase initials", () => {
      const user = {
        name: "alice bob",
        email: "alice@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      expect(screen.getByText("AL")).toBeInTheDocument();
    });

    it("should handle empty string name gracefully", () => {
      const user = {
        name: "",
        email: "test@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      // Should fall back to email
      expect(screen.getByText("TE")).toBeInTheDocument();
    });

    it("should trim whitespace from name for initials", () => {
      const user = {
        name: "  Bob Smith  ",
        email: "bob@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      expect(screen.getByText("BO")).toBeInTheDocument();
    });
  });

  describe("User Name Display", () => {
    it("should display user name in the button", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should display email when name is not provided", () => {
      const user = {
        name: null,
        email: "john@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      expect(screen.getByText("john@example.com")).toBeInTheDocument();
    });

    it("should display Account when neither name nor email is provided", () => {
      const user = {
        name: null,
        email: null,
        image: null,
      };

      render(<UserMenu user={user} />);

      expect(screen.getByText("Account")).toBeInTheDocument();
    });

    it("should truncate long names with CSS", () => {
      const user = {
        name: "Very Long Name That Should Be Truncated",
        email: "long@example.com",
        image: null,
      };

      const { container } = render(<UserMenu user={user} />);

      const nameElement = screen.getByText("Very Long Name That Should Be Truncated");
      expect(nameElement).toHaveClass("truncate");
      expect(nameElement).toHaveClass("max-w-[10ch]");
    });
  });

  describe("Dropdown Toggle", () => {
    it("should not show dropdown menu by default", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      // Logout button should not be visible
      expect(screen.queryByRole("menuitem", { name: /Logout/i })).not.toBeInTheDocument();
    });

    it("should show dropdown menu when button is clicked", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      // Logout button should now be visible
      expect(screen.getByRole("menuitem", { name: /Logout/i })).toBeInTheDocument();
    });

    it("should hide dropdown menu when button is clicked again", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      const button = screen.getByRole("button");

      // Open dropdown
      fireEvent.click(button);
      expect(screen.getByRole("menuitem", { name: /Logout/i })).toBeInTheDocument();

      // Close dropdown
      fireEvent.click(button);
      expect(screen.queryByRole("menuitem", { name: /Logout/i })).not.toBeInTheDocument();
    });

    it("should close dropdown when clicking outside", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      const { container } = render(
        <div>
          <UserMenu user={user} />
          <div data-testid="outside">Outside Element</div>
        </div>
      );

      const button = screen.getByRole("button");

      // Open dropdown
      fireEvent.click(button);
      expect(screen.getByRole("menuitem", { name: /Logout/i })).toBeInTheDocument();

      // Click outside
      const outsideElement = screen.getByTestId("outside");
      fireEvent.click(outsideElement);

      // Dropdown should close
      expect(screen.queryByRole("menuitem", { name: /Logout/i })).not.toBeInTheDocument();
    });

    it("should not close dropdown when clicking inside the dropdown", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      const button = screen.getByRole("button");

      // Open dropdown
      fireEvent.click(button);
      expect(screen.getByRole("menuitem", { name: /Logout/i })).toBeInTheDocument();

      // Click on the menu container (not the logout button)
      const menu = screen.getByRole("menu");
      fireEvent.click(menu);

      // Dropdown should remain open
      expect(screen.getByRole("menuitem", { name: /Logout/i })).toBeInTheDocument();
    });
  });

  describe("Logout Functionality", () => {
    it("should call signOut when Logout button is clicked", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      const logoutButton = screen.getByRole("menuitem", { name: /Logout/i });
      fireEvent.click(logoutButton);

      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/" });
    });

    it("should redirect to home page after logout", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      const logoutButton = screen.getByRole("menuitem", { name: /Logout/i });
      fireEvent.click(logoutButton);

      expect(mockSignOut).toHaveBeenCalledWith(
        expect.objectContaining({
          callbackUrl: "/",
        })
      );
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes on the button", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("aria-haspopup", "menu");
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("should update aria-expanded when menu is opened", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      const button = screen.getByRole("button");

      // Open menu
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");

      // Close menu
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("should have role=menu on the dropdown", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      const menu = screen.getByRole("menu");
      expect(menu).toBeInTheDocument();
    });

    it("should have role=menuitem on logout button", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      const logoutButton = screen.getByRole("menuitem", { name: /Logout/i });
      expect(logoutButton).toBeInTheDocument();
    });
  });

  describe("Event Cleanup", () => {
    it("should cleanup event listener on unmount", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

      const { unmount } = render(<UserMenu user={user} />);

      // Open dropdown to trigger event listener
      const button = screen.getByRole("button");
      fireEvent.click(button);

      // Unmount component
      unmount();

      // Should have removed the event listener
      expect(removeEventListenerSpy).toHaveBeenCalledWith("click", expect.any(Function));
    });
  });

  describe("Edge Cases", () => {
    it("should handle null image URL gracefully", () => {
      const user = {
        name: "John Doe",
        email: "john@example.com",
        image: null,
      };

      const { container } = render(<UserMenu user={user} />);

      // Should show initials, not broken image
      expect(screen.getByText("JO")).toBeInTheDocument();
      expect(container.querySelector("img")).not.toBeInTheDocument();
    });

    it("should handle missing values gracefully", () => {
      const user = {
        name: null,
        email: null,
        image: null,
      };

      render(<UserMenu user={user} />);

      expect(screen.getByText("Account")).toBeInTheDocument();
      expect(screen.getByText("?")).toBeInTheDocument();
    });

    it("should handle single character names", () => {
      const user = {
        name: "X",
        email: "x@example.com",
        image: null,
      };

      const { container } = render(<UserMenu user={user} />);

      // Should show single character in avatar (slice(0, 2) of "X" is "X")
      const avatar = container.querySelector('.inline-flex.h-9.w-9');
      expect(avatar?.textContent).toBe("X");
    });

    it("should handle special characters in names", () => {
      const user = {
        name: "José García",
        email: "jose@example.com",
        image: null,
      };

      render(<UserMenu user={user} />);

      expect(screen.getByText("JO")).toBeInTheDocument();
    });

    it("should handle emoji in names", () => {
      const user = {
        name: "😀 Happy User",
        email: "happy@example.com",
        image: null,
      };

      const { container } = render(<UserMenu user={user} />);

      // Should take first 2 characters (emoji + space) in avatar
      const avatar = container.querySelector('.inline-flex.h-9.w-9');
      expect(avatar?.textContent).toContain("😀");
    });
  });
});
