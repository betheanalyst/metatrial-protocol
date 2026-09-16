import { describe, expect, it } from "vitest";
import {
  actionLabel,
  formatParam,
  humanDuration,
  proposalStatusLabel,
} from "./governance";

describe("governance translations", () => {
  it("translates all seven action types", () => {
    expect(actionLabel("CORE_PARAM_UPDATE")).toBe("Protocol parameter update");
    expect(actionLabel("TREASURY_UPDATE")).toBe("Treasury update");
    expect(actionLabel("PAUSE")).toBe("Emergency pause");
    expect(actionLabel("UNPAUSE")).toBe("Lift pause");
    expect(actionLabel("ADD_ADMIN")).toBe("Add admin");
    expect(actionLabel("REMOVE_ADMIN")).toBe("Remove admin");
    expect(actionLabel("EXTERNAL_SOURCE_UPDATE")).toBe("External source update");
  });

  it("passes unknown action types through unchanged", () => {
    expect(actionLabel("FUTURE_ACTION")).toBe("FUTURE_ACTION");
  });

  it("translates the proposal lifecycle with honest states", () => {
    expect(proposalStatusLabel("PENDING_APPROVALS").label).toBe("Pending approvals");
    expect(proposalStatusLabel("TIMELOCKED").label).toContain("ready to execute");
    expect(proposalStatusLabel("EXECUTED").tone).toBe("final");
    expect(proposalStatusLabel("EXPIRED").tone).toBe("danger");
    expect(proposalStatusLabel("MYSTERY").label).toBe("MYSTERY");
  });

  it("formats governance durations in human units", () => {
    expect(humanDuration(86_400)).toBe("1 day");
    expect(humanDuration(172_800)).toBe("2 days");
    expect(humanDuration(3_600)).toBe("1 hour");
    expect(humanDuration(45)).toBe("45 seconds");
  });

  it("formats window parameters as durations and counts as numbers", () => {
    expect(formatParam("participation_window", 172_800)).toBe("2 days");
    expect(formatParam("appeal_window", 259_200)).toBe("3 days");
    expect(formatParam("max_appeal_rounds", 2)).toBe("2");
    expect(formatParam("confidence_tolerance", 15)).toBe("15");
    expect(formatParam("max_disputes_per_claimant_window", 20)).toBe("20");
  });
});
