import { useEffect, useReducer } from "react";
import {
  assemblePayload,
  decodeSlices,
  Descriptor,
  individualSlicesInStore,
  insertToStore,
  payloadIsReady,
  Slice,
  SliceStore,
  unmarshalDescriptor,
  unmarshalSlice,
  unmarshalSliceIdentifiers,
} from "./FileUtils";

const DATA_RATE_BUFFER_MAX_SECONDS = 5;

type DataRateSample = {
  receivedAt: number;
  bytes: number;
};

const purgeDataRateBuffer = (
  buffer: DataRateSample[],
  maxSeconds: number
): DataRateSample[] => {
  const now = Date.now();
  return buffer.filter((s) => (now - s.receivedAt) / 1000 < maxSeconds);
};

const calculateBitsPerSecond = (buffer: DataRateSample[]): number => {
  const sorted = purgeDataRateBuffer(buffer, DATA_RATE_BUFFER_MAX_SECONDS).sort(
    (a, b) => a.receivedAt - b.receivedAt
  );
  const start = sorted[0]?.receivedAt;
  const end = sorted[sorted.length - 1]?.receivedAt;
  console.log(sorted);
  if (start && end) {
    return (
      (buffer.map((s) => s.bytes).reduce((a, b) => a + b) /
        DATA_RATE_BUFFER_MAX_SECONDS) *
      8
    );
  } else {
    return 0;
  }
};

interface sliceReducerState {
  store: SliceStore;
  descriptor?: Descriptor;
  dataRateBuffer: DataRateSample[];
  lastSliceReceivedOn: number;
}

interface sliceReducerActionDescriptor {
  type: "SET_DESCRIPTOR";
  descriptor: Descriptor;
}

interface sliceReducerActionData {
  type: "ADD_DATA";
  slice: Slice;
}

interface sliceReducerActionCalcDrate {
  type: "CALC_DRATE";
}

const sliceReducer = (
  state: sliceReducerState,
  action:
    | sliceReducerActionData
    | sliceReducerActionDescriptor
    | sliceReducerActionCalcDrate
) => {
  switch (action.type) {
    case "SET_DESCRIPTOR":
      if (
        state.descriptor === undefined ||
        state.descriptor.name !== action.descriptor.name
      ) {
        return {
          descriptor: action.descriptor,
          store: [],
          dataRateBuffer: [],
          lastSliceReceivedOn: 0,
        };
      } else {
        return state;
      }
    case "CALC_DRATE": {
      return {
        ...state,
        dataRateBuffer: purgeDataRateBuffer(
          state.dataRateBuffer,
          DATA_RATE_BUFFER_MAX_SECONDS
        ),
      };
    }
    case "ADD_DATA": {
      if (
        state.descriptor === undefined ||
        state.store.filter((e) => e.identifiers === action.slice.identifiers)
          .length > 0
      ) {
        return state;
      } else {
        const tryDecode = (newSlice: Slice) => {
          const newSlices = decodeSlices(
            state.store,
            state.descriptor?.slizeSize || 0,
            newSlice
          );
          for (let slice of newSlices) {
            insertToStore(state.store, slice);
          }
          insertToStore(state.store, action.slice);
          if (newSlices.length > 0) {
            console.log(
              "new:",
              newSlices.map((e) => unmarshalSliceIdentifiers(e.identifiers))
            );
            for (const slice of state.store) {
              // try to re-decode every frame in the store
              tryDecode(slice);
            }
          }
        };
        if (state.descriptor) {
          tryDecode(action.slice);
        }
        state.dataRateBuffer.push({
          receivedAt: Date.now(),
          bytes: action.slice.payload.length,
        });

        return {
          descriptor: state.descriptor,
          store: state.store,
          dataRateBuffer: purgeDataRateBuffer(
            state.dataRateBuffer,
            DATA_RATE_BUFFER_MAX_SECONDS
          ),
          lastSliceReceivedOn: Date.now(),
        };
      }
    }
    default:
      throw Error("Should not be reached");
  }
};

export interface DecoderResult {
  ready: boolean;
  descriptor?: Descriptor;
  availableSlices: number[];
  callbackFunction: (data: string) => void;
  dataRateInBitsPerSeconds: number;
  getPayload: () => Blob | null;
  totalSlices: number;
  lastSliceReceivedOn?: number;
}

export const useDecoder = (): DecoderResult => {
  const [state, dispatch] = useReducer(sliceReducer, {
    store: [],
    descriptor: undefined,
    dataRateBuffer: [],
    lastSliceReceivedOn: 0,
  });

  const callbackFunction = (data: string) => {
    try {
      const slice = unmarshalSlice(data);
      dispatch({
        type: "ADD_DATA",
        slice: slice,
      });
    } catch (err) {}
    try {
      const unmarshaledDescriptor = unmarshalDescriptor(data);
      dispatch({ type: "SET_DESCRIPTOR", descriptor: unmarshaledDescriptor });
    } catch (err) {}
  };

  const allIndividualSlices = individualSlicesInStore(state.store);
  const ready = state.descriptor
    ? payloadIsReady(state.store, state.descriptor)
    : false;

  const getPayload = (): Blob | null => {
    return state.descriptor
      ? assemblePayload(state.store, state.descriptor)
      : null;
  };

  const dataRate = calculateBitsPerSecond(state.dataRateBuffer);

  useEffect(() => {
    const handle = setInterval(() => {
      dispatch({ type: "CALC_DRATE" });
    }, 1000);
    return () => {
      clearInterval(handle);
    };
  }, [dispatch]);

  return {
    ready: ready,
    descriptor: state.descriptor,
    availableSlices: allIndividualSlices,
    totalSlices: state.store.length,
    callbackFunction: callbackFunction,
    dataRateInBitsPerSeconds: dataRate,
    lastSliceReceivedOn:
      state.lastSliceReceivedOn === 0 ? undefined : state.lastSliceReceivedOn,
    getPayload,
  };
};
