import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createDevice, pantryEntry } from '../../testing/device';
import { FakeServer } from '../../testing/fake-server';
import { useSharing } from '../use-sharing';

describe('useSharing', () => {
  it('reports not ready, then the restored state', async () => {
    const device = createDevice(new FakeServer(), 'user-a');
    await device.runtime.start();
    const loader = () => Promise.resolve(device.runtime);

    const { result } = renderHook(() => useSharing(loader));
    expect(result.current.ready).toBe(false);
    expect(result.current.service).toBeNull();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.snapshot.household).toBeNull();
    expect(result.current.service).toBe(device.service);
  });

  it('re-renders when the household and the sync status change', async () => {
    const device = createDevice(new FakeServer(), 'user-a');
    await device.runtime.start();
    const loader = () => Promise.resolve(device.runtime);
    const { result } = renderHook(() => useSharing(loader));
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await device.service.createHousehold('Home');
      await device.sync();
    });
    expect(result.current.snapshot.household?.name).toBe('Home');
    expect(result.current.snapshot.sync.state).toBe('synced');

    device.backend.online = false;
    await act(async () => {
      await device.pantry.save(pantryEntry('Milk'));
      await device.sync();
    });
    expect(result.current.snapshot.sync).toMatchObject({ state: 'offline', pending: 1 });
  });

  it('keeps the same snapshot object until something changes', async () => {
    const device = createDevice(new FakeServer(), 'user-a');
    await device.runtime.start();

    expect(device.runtime.getSnapshot()).toBe(device.runtime.getSnapshot());
  });
});
