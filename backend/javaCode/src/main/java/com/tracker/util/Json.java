package com.tracker.util;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonParseException;
import com.google.gson.TypeAdapter;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonToken;
import com.google.gson.stream.JsonWriter;

import java.io.IOException;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.function.Function;

/**
 * The one Gson instance for reading request bodies and writing responses.
 * Dates are 'YYYY-MM-DD'; timestamps are ISO-8601 in UTC.
 */
public final class Json {
    public static final Gson GSON = new GsonBuilder()
            .serializeNulls()
            .disableHtmlEscaping()
            .registerTypeAdapter(LocalDate.class, stringAdapter(LocalDate::parse).nullSafe())
            .registerTypeAdapter(Instant.class, stringAdapter(Instant::parse).nullSafe())
            .create();

    private Json() {}

    private static <T> TypeAdapter<T> stringAdapter(Function<String, T> parse) {
        return new TypeAdapter<>() {
            @Override
            public void write(JsonWriter out, T value) throws IOException {
                out.value(value.toString());
            }

            @Override
            public T read(JsonReader in) throws IOException {
                if (in.peek() == JsonToken.NULL) {
                    in.nextNull();
                    return null;
                }
                String text = in.nextString();
                if (text.isBlank()) return null;
                try {
                    return parse.apply(text);
                } catch (DateTimeException e) {
                    throw new JsonParseException("'" + text + "' is not a valid date (use YYYY-MM-DD)");
                }
            }
        };
    }
}
