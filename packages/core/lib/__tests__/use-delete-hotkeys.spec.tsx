import { act, renderHook } from "@testing-library/react";
import { PropsWithChildren } from "react";
import { appStoreContext, createAppStore } from "../../store";
import { monitorHotkeys, useHotkeyStore } from "../use-hotkey";
import { useDeleteHotkeys } from "../use-delete-hotkeys";

describe("useDeleteHotkeys", () => {
  let iframe: HTMLIFrameElement;
  let frameDocument: Document;
  let cleanups: (() => void)[];
  let unmountHook: (() => void) | undefined;

  beforeEach(() => {
    useHotkeyStore.setState({ held: {}, triggers: {} });

    iframe = document.createElement("iframe");
    document.body.appendChild(iframe);

    const contentDocument = iframe.contentDocument;
    if (!contentDocument || !iframe.contentWindow) {
      throw new Error("Expected the iframe to have a document and window");
    }

    frameDocument = contentDocument;
    cleanups = [
      monitorHotkeys(document),
      monitorHotkeys(frameDocument),
    ];

    const appStore = createAppStore();
    const wrapper = ({ children }: PropsWithChildren) => (
      <appStoreContext.Provider value={appStore}>
        {children}
      </appStoreContext.Provider>
    );

    const hook = renderHook(() => useDeleteHotkeys(), { wrapper });
    unmountHook = hook.unmount;
  });

  afterEach(() => {
    unmountHook?.();
    cleanups.forEach((cleanup) => cleanup());
    iframe.remove();
    useHotkeyStore.setState({ held: {}, triggers: {} });
  });

  const createKeydownEvent = (key: "Backspace" | "Delete") => {
    const frameWindow = iframe.contentWindow as typeof window | null;
    if (!frameWindow) {
      throw new Error("Expected the iframe to have a window");
    }

    return new frameWindow.KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: key,
      key,
    });
  };

  it.each(["Backspace", "Delete"] as const)(
    "allows %s to edit an input inside the iframe",
    (key) => {
      const input = frameDocument.createElement("input");
      frameDocument.body.appendChild(input);
      input.focus();

      const event = createKeydownEvent(key);

      act(() => {
        input.dispatchEvent(event);
      });

      expect(event.defaultPrevented).toBe(false);
    }
  );

  it("prevents the native behavior for a delete shortcut on a noneditable canvas target", () => {
    const canvasTarget = frameDocument.createElement("div");
    frameDocument.body.appendChild(canvasTarget);

    const event = createKeydownEvent("Backspace");

    act(() => {
      canvasTarget.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });
});
