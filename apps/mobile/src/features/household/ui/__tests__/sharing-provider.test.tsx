import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { createDevice } from '../../testing/device';
import { FakeServer } from '../../testing/fake-server';
import { SharingProvider, useRemoteRevision, useSharingContext } from '../sharing-provider';
import { useRefetchOnRemoteChange } from '../use-refetch-on-remote-change';

import { sharingValue, SharingTestProvider } from '../../testing/fake-sharing';

describe('useSharingContext without a provider', () => {
  it('reports sharing as unavailable, so the feature stays hidden', () => {
    const { result } = renderHook(() => useSharingContext());

    expect(result.current.snapshot.available).toBe(false);
    expect(result.current.service).toBeNull();
    expect(result.current.snapshot.sync.remoteRevision).toBe(0);
  });
});

describe('SharingProvider', () => {
  it('starts the runtime once and shares it with every consumer', async () => {
    const device = createDevice(new FakeServer(), 'user-a');
    await device.runtime.start();
    const loader = jest.fn(() => Promise.resolve(device.runtime));

    function Probe({ label }: { label: string }) {
      const { snapshot } = useSharingContext();
      return (
        <Text>
          {label}:{String(snapshot.available)}
        </Text>
      );
    }

    render(
      <SharingProvider loader={loader}>
        <Probe label="a" />
        <Probe label="b" />
      </SharingProvider>,
    );

    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/^a:/)).toBeTruthy();
    expect(screen.getByText(/^b:/)).toBeTruthy();
  });

  it('renders its children before the runtime has loaded', () => {
    const loader = () => new Promise<never>(() => undefined);

    render(
      <SharingProvider loader={loader}>
        <Text>content</Text>
      </SharingProvider>,
    );

    expect(screen.getByText('content')).toBeTruthy();
  });
});

describe('useRefetchOnRemoteChange', () => {
  function setup(initial: number) {
    const refetch = jest.fn(() => Promise.resolve());
    let revision = initial;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SharingTestProvider value={sharingValue({ sync: { remoteRevision: revision } })}>
        {children}
      </SharingTestProvider>
    );
    const view = renderHook(() => useRefetchOnRemoteChange(refetch), { wrapper });
    return {
      refetch,
      setRevision(next: number) {
        revision = next;
        view.rerender({});
      },
    };
  }

  it('does not refetch on mount: the screen loads its own data', () => {
    const { refetch } = setup(0);

    expect(refetch).not.toHaveBeenCalled();
  });

  it('refetches when the revision goes up, once per change', () => {
    const { refetch, setRevision } = setup(0);

    act(() => setRevision(1));
    expect(refetch).toHaveBeenCalledTimes(1);

    act(() => setRevision(1));
    expect(refetch).toHaveBeenCalledTimes(1);

    act(() => setRevision(3));
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it('does not refetch for a revision that was already there on mount', () => {
    const { refetch } = setup(7);

    expect(refetch).not.toHaveBeenCalled();
  });

  it('swallows a failing refetch instead of crashing the screen', async () => {
    const refetch = jest.fn(() => Promise.reject(new Error('read failed')));
    let revision = 0;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SharingTestProvider value={sharingValue({ sync: { remoteRevision: revision } })}>
        {children}
      </SharingTestProvider>
    );
    const view = renderHook(() => useRefetchOnRemoteChange(refetch), { wrapper });

    revision = 1;
    await act(async () => view.rerender({}));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('useRemoteRevision', () => {
  it('reads the counter from the shared snapshot', () => {
    const { result } = renderHook(() => useRemoteRevision(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SharingTestProvider value={sharingValue({ sync: { remoteRevision: 4 } })}>
          {children}
        </SharingTestProvider>
      ),
    });

    expect(result.current).toBe(4);
  });
});
