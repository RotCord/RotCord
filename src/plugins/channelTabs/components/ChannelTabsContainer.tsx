/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { classes } from "@utils/misc";
import { LazyComponent, useForceUpdater } from "@utils/react";
import { findByCode } from "@webpack";
import { Button, ContextMenu, Flex, FluxDispatcher, Forms, useCallback, useEffect, useRef, UserStore, useState } from "@webpack/common";

import { BasicChannelTabsProps, ChannelTabsProps, channelTabsSettings as settings, ChannelTabsUtils } from "../util";
import ChannelTab, { PreviewTab } from "./ChannelTab";
import { ChannelContextMenu } from "./ContextMenus";

const {
    closeTab, createTab, handleChannelSwitch, handleKeybinds,
    isTabSelected, moveToTab, saveTabs, openStartupTabs, setUpdaterFunction
} = ChannelTabsUtils;

const PlusIcon = LazyComponent(() => findByCode("15 10 10 10"));
const XIcon = LazyComponent(() => findByCode("M18.4 4L12 10.4L5.6 4L4"));

const cl = (name: string) => `vc-channeltabs-${name}`;

export default function ChannelsTabsContainer(props: BasicChannelTabsProps & { userId: string; }) {
    const { openTabs } = ChannelTabsUtils;
    const [userId, setUserId] = useState(props.userId);

    const _update = useForceUpdater();
    const update = useCallback(() => {
        _update();
        saveTabs(userId);
    }, [userId]);

    const ref = useRef<HTMLDivElement>(null);
    // TODO: find a way to not set this every rerender
    if (ref.current)
        (Vencord.Plugins.plugins.ChannelTabs as any).containerHeight = ref.current.clientHeight;

    useEffect(() => {
        setUpdaterFunction(update);
        const onLogin = () => {
            const { id } = UserStore.getCurrentUser();
            if (id === userId) return;
            setUserId(id);
            openStartupTabs({ ...props, userId: id });
        };
        FluxDispatcher.subscribe("CONNECTION_OPEN_SUPPLEMENTAL", onLogin);
        document.addEventListener("keydown", handleKeybinds);
        return () => {
            FluxDispatcher.unsubscribe("CONNECTION_OPEN_SUPPLEMENTAL", onLogin);
            document.removeEventListener("keydown", handleKeybinds);
        };
    }, []);

    if (!userId) return null;
    handleChannelSwitch(props);
    saveTabs(userId);

    return <div className={cl("container")} ref={ref}>
        {openTabs.map((ch, i) => <div
            className={classes(cl("tab"), ch.compact ? cl("tab-compact") : null, isTabSelected(ch.id) ? cl("tab-selected") : null)}
            key={i}
            onAuxClick={e => {
                if (e.button === 1 /* middle click */) {
                    closeTab(ch.id);
                }
            }}
            onContextMenu={e => ContextMenu.open(e, () => <ChannelContextMenu tab={ch} />)}
        >
            <button
                className={classes(cl("button"), cl("channel-info"))}
                onClick={() => moveToTab(ch.id)}
            >
                <ChannelTab {...ch} index={i} />
            </button>
            {openTabs.length > 1 && (ch.compact ? isTabSelected(ch.id) : true) && <button
                className={classes(cl("button"), cl("close-button"), ch.compact ? cl("close-button-compact") : null)}
                onClick={() => closeTab(ch.id)}
            >
                <XIcon width={16} height={16} />
            </button>}
        </div>)
        }

        <button
            onClick={() => createTab(props, true)}
            className={classes(cl("button"), cl("new-button"))}
        >
            <PlusIcon />
        </button>
    </div >;
}

export function ChannelTabsPreview(p) {
    const id = UserStore.getCurrentUser()?.id;
    if (!id) return <Forms.FormText>there's no logged in account?????</Forms.FormText>;

    const { setValue }: { setValue: (v: { [userId: string]: ChannelTabsProps[]; }) => void; } = p;
    const { tabSet }: { tabSet: { [userId: string]: ChannelTabsProps[]; }; } = settings.use(["tabSet"]);
    const placeholder = [{ guildId: "@me", channelId: undefined as any }];
    const [currentTabs, setCurrentTabs] = useState(tabSet?.[id] ?? placeholder);

    return <>
        <Forms.FormTitle>Startup tabs</Forms.FormTitle>
        <Flex flexDirection="row" style={{ gap: "2px" }}>
            {currentTabs.map(t => <>
                <PreviewTab {...t} />
            </>)}
        </Flex>
        <Flex flexDirection="row-reverse">
            <Button
                onClick={() => {
                    setCurrentTabs([...ChannelTabsUtils.openTabs]);
                    setValue({ ...tabSet, [id]: [...ChannelTabsUtils.openTabs] });
                }}
            >Set to currently open tabs</Button>
        </Flex>
    </>;
}
