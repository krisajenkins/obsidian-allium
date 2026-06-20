import { TextFileView, type WorkspaceLeaf } from "obsidian";
import { createClassComponent } from "svelte/legacy";
import AlliumApp from "./components/AlliumApp.svelte";

export const VIEW_TYPE_ALLIUM = "allium-spec-view";

type AlliumAppInstance = {
  $set(props: Record<string, unknown>): void;
  $destroy(): void;
};

export class AlliumView extends TextFileView {
  private svelteApp: AlliumAppInstance | null = null;
  private fileVersion = 0;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_ALLIUM;
  }

  getDisplayText(): string {
    return this.file?.basename ?? "Allium Spec";
  }

  getIcon(): string {
    return "git-fork";
  }

  getViewData(): string {
    return this.data;
  }

  setViewData(data: string, clear: boolean): void {
    this.data = data;
    if (clear || !this.svelteApp) {
      this.mountSvelte();
    } else {
      this.fileVersion++;
      this.svelteApp.$set({ source: this.data, fileVersion: this.fileVersion });
    }
  }

  clear(): void {
    this.data = "";
    this.destroySvelte();
  }

  async onClose(): Promise<void> {
    this.destroySvelte();
  }

  private mountSvelte(): void {
    this.destroySvelte();
    if (!this.file) return;

    this.contentEl.empty();
    this.contentEl.addClass("allium-spec-container");
    this.fileVersion = 0;

    this.svelteApp = createClassComponent({
      component: AlliumApp,
      target: this.contentEl,
      props: {
        source: this.data,
        fileVersion: this.fileVersion,
      },
    }) as unknown as AlliumAppInstance;
  }

  private destroySvelte(): void {
    if (this.svelteApp) {
      this.svelteApp.$destroy();
      this.svelteApp = null;
    }
  }
}
