import { Plugin } from "obsidian";
import { AlliumView, VIEW_TYPE_ALLIUM } from "./allium-view.svelte";

export default class AlliumPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(VIEW_TYPE_ALLIUM, (leaf) => new AlliumView(leaf));
    this.registerExtensions(["allium"], VIEW_TYPE_ALLIUM);
  }
}
