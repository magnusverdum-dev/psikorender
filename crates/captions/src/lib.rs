use anyhow::{Context, Result};
use shared::{CaptionSegment, CaptionStyle};
use std::{fs, path::Path};
use uuid::Uuid;

pub fn split_into_sentences(text: &str) -> Vec<String> {
    let mut sentences = Vec::new();
    let mut current = String::new();

    for ch in text.chars() {
        current.push(ch);
        if matches!(ch, '.' | '!' | '?' | '\n') {
            let trimmed = current.trim();
            if !trimmed.is_empty() {
                sentences.push(trimmed.to_string());
            }
            current.clear();
        }
    }

    let trimmed = current.trim();
    if !trimmed.is_empty() {
        sentences.push(trimmed.to_string());
    }

    if sentences.is_empty() && !text.trim().is_empty() {
        sentences.push(text.trim().to_string());
    }

    sentences
}

pub fn build_segments(
    project_id: Uuid,
    text: &str,
    duration: f64,
    style: CaptionStyle,
) -> Vec<CaptionSegment> {
    let sentences = split_into_sentences(text);
    let sentence_count = sentences.len();
    let total_weight: usize = sentences.iter().map(|s| s.chars().count().max(1)).sum();
    let mut cursor = 0.0;

    sentences
        .into_iter()
        .enumerate()
        .map(|(index, sentence)| {
            let weight = sentence.chars().count().max(1) as f64 / total_weight.max(1) as f64;
            let mut end = if index + 1 == sentence_count {
                duration
            } else {
                (cursor + duration * weight).min(duration)
            };
            if end - cursor < 1.2 {
                end = (cursor + 1.2).min(duration);
            }
            let segment = CaptionSegment {
                id: Uuid::new_v4(),
                project_id,
                text: sentence,
                start_time: cursor,
                end_time: end,
                style: style.to_string(),
                highlight_words: Vec::new(),
            };
            cursor = end;
            segment
        })
        .collect()
}

pub fn write_ass_file(path: &Path, segments: &[CaptionSegment], style: CaptionStyle) -> Result<()> {
    let style_line = match style {
        CaptionStyle::Minimal => "Style: Default,Inter,78,&H00FFFFFF,&H0000D7FF,&H00101822,&HAA101822,0,0,0,0,100,100,0,0,1,4,2,2,90,90,180,1",
        CaptionStyle::Bold => "Style: Default,Inter,92,&H00FFFFFF,&H0000D7FF,&H00101822,&HAA101822,1,0,0,0,100,100,0,0,1,6,3,2,80,80,170,1",
        CaptionStyle::KaraokeBasic => "Style: Default,Inter,88,&H00FFFFFF,&H0000D7FF,&H000086FF,&HAA101822,1,0,0,0,100,100,0,0,1,5,3,2,80,80,170,1",
        CaptionStyle::Manifesto => "Style: Default,Inter,96,&H00F8FBFF,&H0000D7FF,&H00101822,&HAA101822,1,0,0,0,100,100,0,0,1,7,3,2,70,70,160,1",
    };

    let mut ass = String::from(
        "[Script Info]\nScriptType: v4.00+\nScaledBorderAndShadow: yes\nPlayResX: 1080\nPlayResY: 1920\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\n",
    );
    ass.push_str(style_line);
    ass.push_str(
        "\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n",
    );

    for segment in segments {
        ass.push_str(&format!(
            "Dialogue: 0,{},{},Default,,0,0,0,,{}\n",
            ass_time(segment.start_time),
            ass_time(segment.end_time),
            escape_ass_text(&segment.text, style)
        ));
    }

    fs::write(path, ass)
        .with_context(|| format!("failed to write ASS captions to {}", path.display()))
}

fn escape_ass_text(text: &str, style: CaptionStyle) -> String {
    let base = text
        .replace('\\', "\\\\")
        .replace('{', "\\{")
        .replace('}', "\\}")
        .replace('\n', "\\N");

    match style {
        CaptionStyle::KaraokeBasic => format!("{{\\k40}}{base}"),
        CaptionStyle::Manifesto => base.to_uppercase(),
        _ => base,
    }
}

fn ass_time(seconds: f64) -> String {
    let total_cs = (seconds.max(0.0) * 100.0).round() as u64;
    let cs = total_cs % 100;
    let total_s = total_cs / 100;
    let s = total_s % 60;
    let total_m = total_s / 60;
    let m = total_m % 60;
    let h = total_m / 60;
    format!("{h}:{m:02}:{s:02}.{cs:02}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_sentences() {
        let parts = split_into_sentences("One. Two! Three?");
        assert_eq!(parts.len(), 3);
    }

    #[test]
    fn formats_ass_time() {
        assert_eq!(ass_time(65.23), "0:01:05.23");
    }
}
