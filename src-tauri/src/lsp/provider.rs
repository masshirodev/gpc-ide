use crate::lsp::embedded::EmbeddedLspProvider;
use crate::lsp::stdio::StdioLspProvider;

pub enum LspProviderKind {
    Stdio(StdioLspProvider),
    Embedded(EmbeddedLspProvider),
}

impl LspProviderKind {
    pub async fn send(&self, message: &str) -> Result<(), String> {
        match self {
            Self::Stdio(p) => p.send(message).await,
            Self::Embedded(p) => p.send(message).await,
        }
    }

    pub async fn stop(&self) -> Result<(), String> {
        match self {
            Self::Stdio(p) => p.stop().await,
            Self::Embedded(p) => p.stop().await,
        }
    }

    pub fn is_running(&self) -> bool {
        match self {
            Self::Stdio(p) => p.is_running(),
            Self::Embedded(p) => p.is_running(),
        }
    }
}
